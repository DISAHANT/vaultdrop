import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { deleteObjectSafe } from '@/lib/storage/object-storage';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: {
        files: {
          orderBy: { relativePath: 'asc' },
        },
        snapshots: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }

    if (workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }


    let healthReport = null;
    let skippedReport = [];
    try {
      if (workspace.healthSummary) healthReport = JSON.parse(workspace.healthSummary);
      if (workspace.skippedSummary) skippedReport = JSON.parse(workspace.skippedSummary);
    } catch {}

    const serialized = {
      id: workspace.id,
      name: workspace.name,
      shareCode: workspace.shareCode,
      description: workspace.description,
      fileCount: workspace.totalFiles,
      totalBytes: Number(workspace.totalSize),
      skippedCount: workspace.excludedCount,
      skippedBytes: 0,
      skippedReport,
      healthReport,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      files: workspace.files.map((f) => ({
        id: f.id,
        relativePath: f.relativePath,
        fileName: f.filename,
        fileSize: Number(f.fileSize),
        mimeType: f.mimeType,
        category: f.category,
        isSensitive: f.isSensitive,
        createdAt: f.createdAt,
      })),
      snapshots: workspace.snapshots.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        fileCount: s.totalFiles,
        totalBytes: Number(s.totalSize),
        createdAt: s.createdAt,
      })),
    };

    return NextResponse.json({ workspace: serialized });
  } catch (error) {
    console.error('Fetch workspace details error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace details' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized.' }, { status: 404 });
    }


    const body = await request.json();
    const updated = await prisma.workspace.update({
      where: { id: params.id },
      data: {
        name: body.name ? body.name.trim().slice(0, 200) : undefined,
        description: body.description !== undefined ? body.description.trim().slice(0, 500) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      workspace: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
      },
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: { files: true },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized.' }, { status: 404 });
    }


    // Delete S3 objects concurrently
    Promise.allSettled(
      workspace.files.map((f) => (f.fileKey ? deleteObjectSafe(f.fileKey) : Promise.resolve()))
    ).catch((err) => console.error('Failed to cleanup files for workspace:', err));

    await prisma.workspace.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
