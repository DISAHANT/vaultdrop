import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

interface CompletedWorkspaceFile {
  relativePath: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  category: string;
  isSensitive: boolean;
  s3Key: string;
}

interface CompleteWorkspacePayload {
  workspaceId?: string;
  name: string;
  description?: string;
  fileCount: number;
  totalBytes: number;
  skippedCount: number;
  skippedBytes: number;
  skippedReport: any;
  healthReport: any;
  files: CompletedWorkspaceFile[];
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body: CompleteWorkspacePayload = await request.json();

    if (!body.name || !body.files || body.files.length === 0) {
      return NextResponse.json({ error: 'Workspace name and files are required.' }, { status: 400 });
    }

    const shareCode = nanoid(10).toUpperCase();
    const sensitiveCount = body.files.filter((f) => f.isSensitive).length;

    const workspace = await prisma.workspace.create({
      data: {
        ownerId: user.id,

        shareCode,
        name: body.name.trim().slice(0, 200),
        description: body.description?.trim().slice(0, 500) || null,
        framework: body.healthReport?.framework || null,
        language: body.healthReport?.language || null,
        packageManager: body.healthReport?.packageManager || null,
        totalFiles: body.fileCount,
        totalSize: BigInt(body.totalBytes || 0),
        excludedCount: body.skippedCount || 0,
        sensitiveCount,
        skippedSummary: JSON.stringify(body.skippedReport || {}),
        healthSummary: JSON.stringify(body.healthReport || {}),
        files: {
          create: body.files.map((f) => ({
            relativePath: f.relativePath,
            filename: f.fileName,
            fileSize: BigInt(f.fileSize || 0),
            mimeType: f.mimeType || 'application/octet-stream',
            category: f.category || 'other',
            isSensitive: !!f.isSensitive,
            fileKey: f.s3Key,
          })),
        },
      },
      include: {
        files: true,
      },
    });

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        shareCode: workspace.shareCode,
        fileCount: workspace.totalFiles,
        totalBytes: Number(workspace.totalSize),
        skippedCount: workspace.excludedCount,
        createdAt: workspace.createdAt,
      },
    });
  } catch (error) {
    console.error('Workspace complete error:', error);
    return NextResponse.json({ error: 'Failed to record workspace.' }, { status: 500 });
  }
}
