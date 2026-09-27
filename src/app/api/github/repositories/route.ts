import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { listInstallationRepositories } from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(ip, 'GITHUB');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for GitHub operations. Please wait a minute.' },
        { status: 429 }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection || !connection.githubInstallationId) {
      return NextResponse.json({
        connected: !!connection,
        hasInstallation: false,
        repositories: [],
        totalCount: 0,
        appInstallationUrl: 'https://github.com/apps/vaultdrop-sync/installations/new',
      });
    }

    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').toLowerCase().trim();
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '100', 10);

    const data = await listInstallationRepositories(connection.githubInstallationId, page, perPage);

    let repos = (data.repositories || []).map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || '',
      ownerAvatar: repo.owner?.avatar_url || '',
      private: !!repo.private,
      defaultBranch: repo.default_branch || 'main',
      description: repo.description || null,
      updatedAt: repo.updated_at,
      htmlUrl: repo.html_url,
      permissions: {
        admin: !!repo.permissions?.admin,
        push: !!repo.permissions?.push,
        pull: !!repo.permissions?.pull,
      },
    }));

    if (search) {
      repos = repos.filter(
        (r: any) =>
          r.name.toLowerCase().includes(search) ||
          r.fullName.toLowerCase().includes(search) ||
          (r.description && r.description.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      connected: true,
      hasInstallation: true,
      totalCount: repos.length,
      repositories: repos,
    });
  } catch (error: any) {
    console.error('List GitHub repositories error:', error);
    const statusCode = error?.info?.statusCode || error?.status || 500;
    return NextResponse.json(
      {
        error: error?.info?.reason || error?.message || 'Failed to list GitHub repositories',
        details: error?.info || null,
      },
      { status: statusCode }
    );
  }
}
