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

    let skippedSummaryStr: string | null = null;
    let healthSummaryStr: string | null = null;
    try {
      if (body.skippedReport) {
        skippedSummaryStr = JSON.stringify(body.skippedReport);
      }
      if (body.healthReport) {
        healthSummaryStr = JSON.stringify(body.healthReport);
      }
    } catch {}

    const totalBytesNum = Math.max(0, Math.round(Number(body.totalBytes || 0)));

    // Create workspace record first
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
        totalSize: BigInt(totalBytesNum),
        excludedCount: body.skippedCount || 0,
        sensitiveCount,
        skippedSummary: skippedSummaryStr,
        healthSummary: healthSummaryStr,
      },
    });

    // Chunked insert of workspace files (200 files per chunk) to avoid database payload limits
    const CHUNK_SIZE = 200;
    const fileRecords = body.files.map((f) => ({
      workspaceId: workspace.id,
      relativePath: (f.relativePath || f.fileName || 'file').slice(0, 1000),
      filename: (f.fileName || 'file').slice(0, 255),
      fileSize: BigInt(Math.max(0, Math.round(Number(f.fileSize || 0)))),
      mimeType: (f.mimeType || 'application/octet-stream').slice(0, 100),
      category: (f.category || 'other').slice(0, 50),
      isSensitive: !!f.isSensitive,
      fileKey: f.s3Key ? f.s3Key.slice(0, 500) : null,
    }));

    for (let i = 0; i < fileRecords.length; i += CHUNK_SIZE) {
      const chunk = fileRecords.slice(i, i + CHUNK_SIZE);
      await prisma.workspaceFile.createMany({
        data: chunk,
      });
    }

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
  } catch (error: any) {
    console.error('Workspace complete error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record workspace.' }, { status: 500 });
  }
}
