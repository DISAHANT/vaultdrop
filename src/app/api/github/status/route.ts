import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { listInstallationRepositories } from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET() {
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
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
        connection: null,
        repoCount: 0,
        appInstallationUrl: 'https://github.com/apps/vaultdrop-sync/installations/new',
      });
    }

    let repoCount = 0;
    let installationValid = false;

    if (connection.githubInstallationId) {
      try {
        const repoData = await listInstallationRepositories(connection.githubInstallationId, 1, 1);
        repoCount = repoData.totalCount;
        installationValid = true;
      } catch (err: any) {
        console.warn('Could not verify installation repositories:', err?.message);
        if (err?.info?.statusCode === 404 || err?.info?.statusCode === 401) {
          installationValid = false;
        }
      }
    }

    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        githubLogin: connection.githubLogin,
        githubAvatarUrl: connection.githubAvatarUrl,
        githubAccountType: connection.githubAccountType,
        installationId: connection.githubInstallationId,
        hasInstallation: !!connection.githubInstallationId && installationValid,
        connectedAt: connection.connectedAt,
      },
      repoCount,
      appInstallationUrl: 'https://github.com/apps/vaultdrop-sync/installations/new',
    });
  } catch (error: any) {
    console.error('Fetch GitHub status error:', error);
    return NextResponse.json({ error: 'Failed to fetch GitHub status' }, { status: 500 });
  }
}
