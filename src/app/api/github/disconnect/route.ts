import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Delete all active connections for this VaultDrop user
    const deletedConnections = await prisma.gitHubConnection.deleteMany({
      where: { vaultdropUserId: user.id },
    });

    // 2. Unlink any workspace-github repository mappings for this VaultDrop user
    const deletedMappings = await prisma.workspaceGitHubRepo.deleteMany({
      where: { vaultdropUserId: user.id },
    });

    // 3. Audit log disconnection
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        operation: 'DISCONNECT',
        status: 'success',
        metadata: JSON.stringify({
          connectionsDeleted: deletedConnections.count,
          mappingsDeleted: deletedMappings.count,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'GitHub account disconnected.',
      details: {
        connectionsDeleted: deletedConnections.count,
        mappingsDeleted: deletedMappings.count,
      },
    });
  } catch (error: any) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect GitHub account' }, { status: 500 });
  }
}
