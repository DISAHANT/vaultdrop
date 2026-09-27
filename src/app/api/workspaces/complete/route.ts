import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { nanoid } from 'nanoid';
import { objectExists } from '@/lib/storage/object-storage';
import { createWorkspacePackage } from '@/lib/workspace/package';

export const dynamic = 'force-dynamic';

interface CompletedWorkspaceFile {
  relativePath: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  category: string;
  isSensitive: boolean;
  s3Key: string;
  checksum?: string;
}

interface CompleteWorkspacePayload {
  workspaceId?: string;      // Upload session ID for idempotency
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

    // ─── Idempotency: Check if workspace already exists for this upload session ───
    const uploadSessionId = body.workspaceId || null;
    if (uploadSessionId) {
      const existing = await prisma.workspace.findFirst({
        where: {
          uploadSessionId,
          ownerId: user.id,
        },
      });

      if (existing) {
        // Return existing workspace (idempotent retry)
        console.log(`[complete] Idempotent hit: workspace ${existing.id} already exists for session ${uploadSessionId}`);
        return NextResponse.json({
          success: true,
          workspace: {
            id: existing.id,
            name: existing.name,
            shareCode: existing.shareCode,
            fileCount: existing.totalFiles,
            totalBytes: Number(existing.totalSize),
            skippedCount: existing.excludedCount,
            workspaceStatus: existing.workspaceStatus,
            createdAt: existing.createdAt,
          },
        });
      }
    }

    // ─── Verify file uploads in storage ───
    console.log(`[complete] Verifying ${body.files.length} files in storage`);

    const verifiedFiles: CompletedWorkspaceFile[] = [];
    const failedVerifications: string[] = [];

    // Verify in batches of 30
    const VERIFY_BATCH = 30;
    for (let i = 0; i < body.files.length; i += VERIFY_BATCH) {
      const batch = body.files.slice(i, i + VERIFY_BATCH);
      const results = await Promise.all(
        batch.map(async (file) => {
          if (!file.s3Key) return { file, exists: false };
          const exists = await objectExists(file.s3Key);
          return { file, exists };
        })
      );

      for (const { file, exists } of results) {
        if (exists) {
          verifiedFiles.push(file);
        } else {
          failedVerifications.push(file.relativePath);
        }
      }
    }

    // ─── FAIL if verification finds missing files ───
    if (failedVerifications.length > 0) {
      console.error(
        `[complete] Storage verification failed: ${failedVerifications.length}/${body.files.length} files not found. Missing: ${failedVerifications.slice(0, 5).join(', ')}`
      );

      // Allow completion if >80% of files are verified (some might still be uploading)
      if (verifiedFiles.length < body.files.length * 0.8) {
        return NextResponse.json(
          {
            error: `Storage verification failed: ${failedVerifications.length} files could not be verified.`,
            failedCount: failedVerifications.length,
            totalCount: body.files.length,
            verifiedCount: verifiedFiles.length,
            failedPaths: failedVerifications.slice(0, 20),
          },
          { status: 422 }
        );
      }
    }

    const shareCode = nanoid(10).toUpperCase();
    const sensitiveCount = verifiedFiles.filter((f) => f.isSensitive).length;

    let skippedSummaryStr: string | null = null;
    let healthSummaryStr: string | null = null;
    try {
      if (body.skippedReport) skippedSummaryStr = JSON.stringify(body.skippedReport);
      if (body.healthReport) healthSummaryStr = JSON.stringify(body.healthReport);
    } catch {}

    const totalBytesNum = Math.max(0, Math.round(Number(body.totalBytes || 0)));

    // ─── Create workspace record with VERIFYING status ───
    const workspace = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        uploadSessionId: uploadSessionId || undefined,
        shareCode,
        name: body.name.trim().slice(0, 200),
        description: body.description?.trim().slice(0, 500) || null,
        framework: body.healthReport?.framework || null,
        language: body.healthReport?.language || null,
        packageManager: body.healthReport?.packageManager || null,
        totalFiles: verifiedFiles.length,
        totalSize: BigInt(totalBytesNum),
        excludedCount: body.skippedCount || 0,
        sensitiveCount,
        skippedSummary: skippedSummaryStr,
        healthSummary: healthSummaryStr,
        workspaceStatus: 'VERIFYING',
        verifiedFileCount: verifiedFiles.length,
      },
    });

    // ─── Chunked insert of workspace files (200 per chunk) ───
    const CHUNK_SIZE = 200;
    const fileRecords = verifiedFiles.map((f) => ({
      workspaceId: workspace.id,
      relativePath: (f.relativePath || f.fileName || 'file').slice(0, 1000),
      filename: (f.fileName || 'file').slice(0, 255),
      fileSize: BigInt(Math.max(0, Math.round(Number(f.fileSize || 0)))),
      mimeType: (f.mimeType || 'application/octet-stream').slice(0, 100),
      category: (f.category || 'other').slice(0, 50),
      isSensitive: !!f.isSensitive,
      fileKey: f.s3Key ? f.s3Key.slice(0, 500) : null,
      checksum: f.checksum ? f.checksum.slice(0, 64) : null,
      uploadVerified: true,
    }));

    for (let i = 0; i < fileRecords.length; i += CHUNK_SIZE) {
      const chunk = fileRecords.slice(i, i + CHUNK_SIZE);
      await prisma.workspaceFile.createMany({ data: chunk });
    }

    // ─── Create workspace package (ZIP) asynchronously ───
    // Don't await — let it run in background so the response is fast
    // The workspace status will transition: VERIFYING → PACKAGING → READY or FAILED
    createWorkspacePackage(workspace.id)
      .then((result) => {
        if (!result.success) {
          console.error(`[complete] Background package creation failed for workspace ${workspace.id}:`, result);
        } else {
          console.log(`[complete] Background package created for workspace ${workspace.id}: ${(result as any).filesIncluded} files`);
        }
      })
      .catch((err) => {
        console.error(`[complete] Background package creation error for workspace ${workspace.id}:`, err);
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
        workspaceStatus: workspace.workspaceStatus,
        verifiedFiles: verifiedFiles.length,
        failedVerifications: failedVerifications.length,
        createdAt: workspace.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[complete] Workspace complete error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record workspace.' }, { status: 500 });
  }
}
