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
    const url = new URL(request.url);
    const branch = url.searchParams.get('branch') || 'main';

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

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VaultDrop-Sync-App',
    };

    // 1. Fetch commits
    const commitsRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&per_page=15`,
      { headers }
    );

    if (!commitsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch commits' }, { status: commitsRes.status });
    }

    const commitsData = await commitsRes.json();

    // 2. Fetch check runs for the latest commit (if exists)
    let latestChecks: any[] = [];
    if (commitsData.length > 0) {
      const latestSha = commitsData[0].sha;
      try {
        const checkRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${latestSha}/check-runs`,
          { headers }
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          latestChecks = (checkData.check_runs || []).map((cr: any) => ({
            id: cr.id,
            name: cr.name,
            status: cr.status,
            conclusion: cr.conclusion,
            startedAt: cr.started_at,
            completedAt: cr.completed_at,
            htmlUrl: cr.html_url,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch check runs for latest commit:', err);
      }
    }

    const commits = commitsData.map((c: any) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit?.message || '',
      authorName: c.commit?.author?.name || c.author?.login || 'Unknown',
      authorAvatar: c.author?.avatar_url || null,
      date: c.commit?.author?.date || c.commit?.committer?.date,
      htmlUrl: c.html_url,
    }));

    return NextResponse.json({
      commits,
      latestChecks,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error fetching commits' }, { status: 500 });
  }
}
