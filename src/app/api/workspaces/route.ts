import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          {
            shares: {
              some: {
                OR: [
                  { recipientId: user.id },
                  { recipientEmail: user.email.toLowerCase() },
                ],
              },
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        shares: {
          select: { id: true, recipientEmail: true, permission: true },
        },
        snapshots: {
          select: { id: true, name: true, createdAt: true },
        },
      },
    });

    const serialized = workspaces.map((ws) => {
      let healthReport = null;
      try {
        if (ws.healthSummary) healthReport = JSON.parse(ws.healthSummary);
      } catch {}

      const isOwner = ws.ownerId === user.id;

      return {
        id: ws.id,
        name: ws.name,
        shareCode: ws.shareCode,
        description: ws.description,
        fileCount: ws.totalFiles,
        totalBytes: Number(ws.totalSize),
        skippedCount: ws.excludedCount,
        skippedBytes: 0,
        healthReport,
        isOwner,
        ownerName: ws.owner?.name || ws.owner?.email || 'Developer',
        sharesCount: ws.shares.length,
        snapshotsCount: ws.snapshots.length,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      };
    });

    return NextResponse.json({ workspaces: serialized });
  } catch (error) {
    console.error('Fetch workspaces error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}
