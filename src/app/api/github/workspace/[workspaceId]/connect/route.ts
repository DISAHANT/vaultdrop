import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    const mapping = await prisma.workspaceGitHubRepo.findFirst({
      where: {
        workspaceId,
        vaultdropUserId: user.id,
      },
    });

    return NextResponse.json({
      connected: !!mapping,
      repo: mapping || null,
    });
  } catch (error: any) {
    console.error('Fetch workspace repo mapping error:', error);
    return NextResponse.json({ error: 'Failed to fetch repository mapping' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    // Verify workspace ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 403 });
    }

    // Verify user's GitHub connection
    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
    });

    if (!connection || !connection.githubInstallationId) {
      return NextResponse.json(
        { error: 'GitHub is not connected or app is not installed.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { repositoryId, owner, repositoryName, defaultBranch = 'main' } = body;

    if (!repositoryId || !owner || !repositoryName) {
      return NextResponse.json(
        { error: 'Missing repositoryId, owner, or repositoryName.' },
        { status: 400 }
      );
    }

    // Upsert mapping for this workspace
    const mapping = await prisma.workspaceGitHubRepo.upsert({
      where: {
        workspaceId_repositoryId: {
          workspaceId,
          repositoryId: Number(repositoryId),
        },
      },
      update: {
        owner,
        repositoryName,
        defaultBranch,
        installationId: connection.githubInstallationId,
        updatedAt: new Date(),
      },
      create: {
        workspaceId,
        vaultdropUserId: user.id,
        installationId: connection.githubInstallationId,
        repositoryId: Number(repositoryId),
        owner,
        repositoryName,
        defaultBranch,
      },
    });

    // Audit log
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId,
        repositoryId: Number(repositoryId),
        repositoryName: `${owner}/${repositoryName}`,
        operation: 'CONNECT',
        status: 'success',
        metadata: JSON.stringify({ branch: defaultBranch }),
      },
    });

    return NextResponse.json({
      success: true,
      repo: mapping,
    });
  } catch (error: any) {
    console.error('Connect workspace repository error:', error);
    return NextResponse.json({ error: 'Failed to connect repository to workspace' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    const deleted = await prisma.workspaceGitHubRepo.deleteMany({
      where: {
        workspaceId,
        vaultdropUserId: user.id,
      },
    });

    // Audit log
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId,
        operation: 'DISCONNECT',
        status: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Repository disconnected from workspace.',
      count: deleted.count,
    });
  } catch (error: any) {
    console.error('Disconnect workspace repository error:', error);
    return NextResponse.json({ error: 'Failed to disconnect repository' }, { status: 500 });
  }
}
