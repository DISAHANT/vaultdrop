import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshots = await prisma.workspaceSnapshot.findMany({
      where: {
        workspaceId: params.id,
        workspace: { ownerId: userId },
      },
      orderBy: { createdAt: 'desc' },
    });

    const serialized = snapshots.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      fileCount: s.totalFiles,
      totalBytes: Number(s.totalSize),
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ snapshots: serialized });
  } catch (error) {
    console.error('Fetch snapshots error:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: {
        snapshots: true,
      },
    });

    if (!workspace || workspace.ownerId !== userId) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nextIndex = workspace.snapshots.length + 1;
    const snapshotName = body.name?.trim() || `Snapshot ${String(nextIndex).padStart(2, '0')}`;
    const description = body.description?.trim() || `Saved state of ${workspace.totalFiles} files`;

    const snapshot = await prisma.workspaceSnapshot.create({
      data: {
        workspaceId: workspace.id,
        snapshotNumber: nextIndex,
        name: snapshotName,
        description,
        totalFiles: workspace.totalFiles,
        totalSize: workspace.totalSize,
      },
    });

    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        description: snapshot.description,
        fileCount: snapshot.totalFiles,
        totalBytes: Number(snapshot.totalSize),
        createdAt: snapshot.createdAt,
      },
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}
