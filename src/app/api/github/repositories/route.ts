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

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(ip, 'GITHUB');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before creating another repository.' },
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

    if (!connection) {
      return NextResponse.json(
        {
          error: 'GitHub account is not connected.',
          details: {
            step: 'Connection Check',
            statusCode: 401,
            errorCode: 'NOT_CONNECTED',
            reason: 'You must connect your GitHub account to create repositories.',
            suggestedFix: 'Connect your GitHub account from the GitHub dashboard.',
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      name,
      description = '',
      isPrivate = true,
      autoInit = false,
      gitignoreTemplate = '',
      workspaceId,
    } = body;

    const cleanName = (name || '').trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    if (!cleanName) {
      return NextResponse.json(
        { error: 'Repository name is required and must contain valid characters.' },
        { status: 400 }
      );
    }

    // Determine authorization token: prioritize user accessToken, fallback to installation token
    let token: string | null = connection.accessToken || null;
    if (!token && connection.githubInstallationId) {
      try {
        const { getInstallationAccessToken } = await import('@/lib/github/app');
        token = await getInstallationAccessToken(connection.githubInstallationId);
      } catch (err) {
        console.warn('Failed to obtain installation token for repo creation:', err);
      }
    }

    if (!token) {
      return NextResponse.json(
        {
          error: 'GitHub authorization token missing.',
          details: {
            step: 'Token Validation',
            statusCode: 401,
            errorCode: 'TOKEN_MISSING',
            reason: 'No valid GitHub token available to create repositories.',
            suggestedFix: 'Reconnect your GitHub account in VaultDrop.',
          },
        },
        { status: 401 }
      );
    }

    const payload: any = {
      name: cleanName,
      description: description.trim(),
      private: isPrivate,
      auto_init: autoInit,
    };

    if (gitignoreTemplate && gitignoreTemplate !== 'None') {
      payload.gitignore_template = gitignoreTemplate;
    }

    const ghRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'VaultDrop-Sync-App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const repoData = await ghRes.json();

    if (!ghRes.ok) {
      const is403 = ghRes.status === 403;
      return NextResponse.json(
        {
          error: repoData.message || 'Failed to create repository on GitHub.',
          details: {
            step: 'Repository Creation',
            statusCode: ghRes.status,
            errorCode: is403 ? 'PERMISSION_DENIED' : 'CREATION_FAILED',
            reason: is403
              ? 'GitHub requires repo permissions to create personal repositories. Please reconnect GitHub.'
              : repoData.message || 'GitHub API rejected the repository creation request.',
            suggestedFix: is403
              ? 'Click Reconnect GitHub to grant repository creation access.'
              : 'Choose a different repository name or check GitHub account status.',
            reconnectUrl: '/api/github/connect',
          },
        },
        { status: ghRes.status }
      );
    }

    const createdRepo = {
      id: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      owner: repoData.owner?.login || connection.githubLogin,
      ownerAvatar: repoData.owner?.avatar_url || connection.githubAvatarUrl,
      private: !!repoData.private,
      defaultBranch: repoData.default_branch || 'main',
      description: repoData.description || null,
      updatedAt: repoData.updated_at || new Date().toISOString(),
      htmlUrl: repoData.html_url,
    };

    // If workspaceId is provided, link workspace immediately!
    let linkedMapping: any = null;
    if (workspaceId && connection.githubInstallationId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (workspace && workspace.ownerId === user.id) {
        linkedMapping = await prisma.workspaceGitHubRepo.upsert({
          where: {
            workspaceId_repositoryId: {
              workspaceId,
              repositoryId: createdRepo.id,
            },
          },
          update: {
            owner: createdRepo.owner,
            repositoryName: createdRepo.name,
            defaultBranch: createdRepo.defaultBranch,
            installationId: connection.githubInstallationId,
            updatedAt: new Date(),
          },
          create: {
            workspaceId,
            vaultdropUserId: user.id,
            installationId: connection.githubInstallationId,
            repositoryId: createdRepo.id,
            owner: createdRepo.owner,
            repositoryName: createdRepo.name,
            defaultBranch: createdRepo.defaultBranch,
          },
        });
      }
    }

    // Audit log
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId: workspaceId || null,
        repositoryId: createdRepo.id,
        repositoryName: createdRepo.fullName,
        operation: 'CREATE_REPOSITORY',
        status: 'success',
        metadata: JSON.stringify({
          repoName: createdRepo.name,
          owner: createdRepo.owner,
          private: createdRepo.private,
          linkedWorkspaceId: workspaceId || null,
        }),
      },
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        type: 'github_repo_created',
        title: 'GitHub repository created',
        message: `Created repository "${createdRepo.fullName}" (${createdRepo.private ? 'Private' : 'Public'})`,
        workspaceId: workspaceId || null,
        metadata: JSON.stringify({
          repository: createdRepo.fullName,
          htmlUrl: createdRepo.htmlUrl,
          defaultBranch: createdRepo.defaultBranch,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      repository: createdRepo,
      linkedMapping,
    });
  } catch (error: any) {
    console.error('Create GitHub repository error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to create repository',
        details: {
          step: 'Repository Creation',
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          reason: error?.message || 'An unexpected error occurred while creating the repository.',
        },
      },
      { status: 500 }
    );
  }
}
