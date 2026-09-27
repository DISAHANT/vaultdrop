import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getInstallationAccessToken } from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { owner, repo } = params;

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 });
    }

    let token: string | null = null;
    if (connection.githubInstallationId) {
      try {
        token = await getInstallationAccessToken(connection.githubInstallationId);
      } catch {}
    }
    if (!token && connection.accessToken) {
      token = connection.accessToken;
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token unavailable' }, { status: 401 });
    }

    const branchesRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'VaultDrop-Sync-App',
        },
      }
    );

    if (!branchesRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch branches from GitHub' }, { status: branchesRes.status });
    }

    const branches = await branchesRes.json();
    return NextResponse.json({
      branches: (branches || []).map((b: any) => ({
        name: b.name,
        commitSha: b.commit?.sha,
        protected: !!b.protected,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error fetching branches' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { owner, repo } = params;

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 });
    }

    let token: string | null = null;
    if (connection.githubInstallationId) {
      try {
        token = await getInstallationAccessToken(connection.githubInstallationId);
      } catch {}
    }
    if (!token && connection.accessToken) {
      token = connection.accessToken;
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token unavailable' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const branchName = (body.branchName || '').trim().replace(/[^a-zA-Z0-9._\-/]/g, '-');
    const baseBranch = (body.baseBranch || 'main').trim();

    if (!branchName) {
      return NextResponse.json({ error: 'Branch name is required.' }, { status: 400 });
    }

    // 1. Fetch base branch SHA
    const baseRefRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'VaultDrop-Sync-App',
        },
      }
    );

    if (!baseRefRes.ok) {
      return NextResponse.json(
        { error: `Base branch "${baseBranch}" not found on repository.` },
        { status: 404 }
      );
    }

    const baseRefData = await baseRefRes.json();
    const baseSha = baseRefData.object.sha;

    // 2. Create new branch reference
    const createRefRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'VaultDrop-Sync-App',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    );

    if (!createRefRes.ok) {
      const errData = await createRefRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errData.message || 'Failed to create branch on GitHub.',
          details: errData,
        },
        { status: createRefRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      branchName,
      baseBranch,
      sha: baseSha,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error creating branch' }, { status: 500 });
  }
}
