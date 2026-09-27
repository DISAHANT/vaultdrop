import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { getInstallationAccessToken, getRepositoryMetadata } from '@/lib/github/app';

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

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
    });

    if (!connection || !connection.githubInstallationId) {
      return NextResponse.json({ error: 'GitHub is not connected or app is not installed.' }, { status: 403 });
    }

    const { owner, repo } = params;
    const metadata = await getRepositoryMetadata(connection.githubInstallationId, owner, repo);

    // Also fetch branches list
    const token = await getInstallationAccessToken(connection.githubInstallationId);
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

    const branches = branchesRes.ok ? await branchesRes.json() : [];

    return NextResponse.json({
      repository: {
        id: metadata.id,
        name: metadata.name,
        fullName: metadata.full_name,
        owner: metadata.owner?.login,
        defaultBranch: metadata.default_branch,
        private: !!metadata.private,
        description: metadata.description,
        htmlUrl: metadata.html_url,
        branches: branches.map((b: any) => ({
          name: b.name,
          protected: !!b.protected,
          commitSha: b.commit?.sha,
        })),
      },
    });
  } catch (error: any) {
    console.error('Fetch repository details error:', error);
    const statusCode = error?.info?.statusCode || error?.status || 500;
    return NextResponse.json(
      {
        error: error?.info?.reason || error?.message || 'Failed to fetch repository details',
        details: error?.info || null,
      },
      { status: statusCode }
    );
  }
}
