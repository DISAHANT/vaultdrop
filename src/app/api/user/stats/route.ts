import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { getUserStats } from '@/lib/services/share-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id!;
    const [shareStats, workspaces, devices, clipboardCount] = await Promise.all([
      getUserStats(userId),
      prisma.workspace.findMany({
        where: { ownerId: userId },
        select: { totalFiles: true, totalSize: true },
      }),
      prisma.userDevice.findMany({
        where: { userId },
        select: { id: true, lastSeenAt: true },
      }),
      prisma.clipboardItem.count({
        where: { userId },
      }),
    ]);

    const now = Date.now();
    const onlineDevices = devices.filter((d) => now - new Date(d.lastSeenAt).getTime() < 30000).length;

    const workspaceFilesCount = workspaces.reduce((sum, w) => sum + w.totalFiles, 0);
    const workspaceBytes = workspaces.reduce((sum, w) => sum + Number(w.totalSize), 0);
    const totalStoredSize = Number(shareStats.totalStoredSize) + workspaceBytes;

    return NextResponse.json({
      ...shareStats,
      totalStoredSize: totalStoredSize.toString(),
      workspacesCount: workspaces.length,
      workspaceFilesCount,
      workspaceBytes,
      totalDevices: devices.length,
      onlineDevices,
      clipboardCount,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats.' }, { status: 500 });
  }
}
