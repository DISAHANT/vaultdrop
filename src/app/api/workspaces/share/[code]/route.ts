import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const user = await getSessionUser();
    const shareCode = params.code.toUpperCase();

    const workspace = await prisma.workspace.findUnique({
      where: { shareCode },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        files: {
          orderBy: { relativePath: 'asc' },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found or expired.' }, { status: 404 });
    }

    let healthReport = null;
    let skippedReport = [];
    try {
      if (workspace.healthSummary) healthReport = JSON.parse(workspace.healthSummary);
      if (workspace.skippedSummary) skippedReport = JSON.parse(workspace.skippedSummary);
    } catch {}

    const isOwner = user ? workspace.ownerId === user.id : false;

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        shareCode: workspace.shareCode,
        description: workspace.description,
        framework: workspace.framework,
        language: workspace.language,
        packageManager: workspace.packageManager,
        fileCount: workspace.totalFiles,
        totalBytes: Number(workspace.totalSize),
        skippedCount: workspace.excludedCount,
        skippedBytes: 0,
        healthReport,
        isOwner,
        ownerName: workspace.owner?.name || workspace.owner?.email || 'Developer',
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
      },
    });
  } catch (error: any) {
    console.error('Fetch public workspace error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}
