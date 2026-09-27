import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { getObjectBufferSafe, getObjectStreamSafe } from '@/lib/storage/object-storage';
import archiver from 'archiver';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get('code');

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: {
        shares: true,
        files: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }

    // ─── Authorization Check ───
    const isOwner = user && workspace.ownerId === user.id;
    const matchedShare = user
      ? workspace.shares.find(
          (s) => (s.recipientId === user.id || s.recipientEmail === user.email.toLowerCase()) && s.status !== 'revoked'
        )
      : null;
    const isSharedRecipient = !!matchedShare;
    const isValidCode = codeParam && codeParam.toUpperCase() === workspace.shareCode.toUpperCase();

    if (!isOwner && !isSharedRecipient && !isValidCode) {
      return NextResponse.json({ error: 'Unauthorized to download this workspace.' }, { status: 403 });
    }

    // ─── Check workspace readiness ───
    if (workspace.workspaceStatus === 'FAILED') {
      return NextResponse.json(
        { error: 'This workspace failed to package. Please ask the owner to re-upload.' },
        { status: 422 }
      );
    }

    const sanitizedName = workspace.name.replace(/[^\w\s\-]/g, '_');

    // ─── Strategy 1: Stream pre-built package (preferred, fast) ───
    if (workspace.packageKey) {
      console.log(`[download] Streaming pre-built package for workspace ${workspace.id}`);

      const streamResult = await getObjectStreamSafe(workspace.packageKey);

      if (streamResult) {
        // Track the download
        if (matchedShare) {
          await prisma.workspaceShare.update({
            where: { id: matchedShare.id },
            data: {
              downloadCount: { increment: 1 },
              downloadedAt: new Date(),
              status: 'downloaded',
            },
          }).catch(() => {});
        }

        // Stream the response
        const readableStream = new ReadableStream({
          start(controller) {
            streamResult.stream.on('data', (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk));
            });
            streamResult.stream.on('end', () => {
              controller.close();
            });
            streamResult.stream.on('error', (err: Error) => {
              controller.error(err);
            });
          },
        });

        return new NextResponse(readableStream, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${sanitizedName}.zip"`,
            ...(streamResult.contentLength > 0 ? { 'Content-Length': streamResult.contentLength.toString() } : {}),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition, X-VaultDrop-Checksum, X-VaultDrop-Files',
            ...(workspace.packageChecksum ? { 'X-VaultDrop-Checksum': workspace.packageChecksum } : {}),
            'X-VaultDrop-Files': workspace.verifiedFileCount?.toString() || workspace.totalFiles.toString(),
          },
        });
      }

      console.warn(`[download] Pre-built package ${workspace.packageKey} not found in storage, falling back to on-the-fly`);
    }

    // ─── Strategy 2: On-the-fly ZIP assembly (fallback, reports errors) ───
    console.log(`[download] Building ZIP on-the-fly for workspace ${workspace.id} (${workspace.files.length} files)`);

    const archive = archiver('zip', { zlib: { level: 4 } });
    const missingFiles: string[] = [];
    let includedCount = 0;

    for (const file of workspace.files) {
      if (!file.fileKey) {
        missingFiles.push(file.relativePath);
        continue;
      }

      try {
        const buffer = await getObjectBufferSafe(file.fileKey);
        if (buffer) {
          archive.append(buffer, { name: file.relativePath });
          includedCount++;
        } else {
          missingFiles.push(file.relativePath);
        }
      } catch (err) {
        console.error(`[download] Failed to fetch file ${file.relativePath}:`, err);
        missingFiles.push(file.relativePath);
      }
    }

    // ─── CRITICAL: Report missing files instead of silent success ───
    if (missingFiles.length > 0) {
      const totalExpected = workspace.files.length;
      console.error(
        `[download] INTEGRITY VIOLATION: ${missingFiles.length}/${totalExpected} files missing for workspace ${workspace.id}. Missing: ${missingFiles.slice(0, 10).join(', ')}${missingFiles.length > 10 ? '...' : ''}`
      );

      // If more than 20% of files are missing, fail the download entirely
      if (missingFiles.length > totalExpected * 0.2) {
        return NextResponse.json(
          {
            error: 'Download failed: Too many files are unavailable from storage.',
            expectedFiles: totalExpected,
            missingFiles: missingFiles.length,
            missingPaths: missingFiles.slice(0, 20),
          },
          { status: 503 }
        );
      }
    }

    const zipChunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => zipChunks.push(c));

    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(zipChunks);

    // Track the download
    if (matchedShare) {
      await prisma.workspaceShare.update({
        where: { id: matchedShare.id },
        data: {
          downloadCount: { increment: 1 },
          downloadedAt: new Date(),
          status: 'downloaded',
        },
      }).catch(() => {});
    }

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition, X-VaultDrop-Files, X-VaultDrop-Missing',
        'X-VaultDrop-Files': includedCount.toString(),
        ...(missingFiles.length > 0 ? { 'X-VaultDrop-Missing': missingFiles.length.toString() } : {}),
      },
    });
  } catch (error) {
    console.error('[download] Workspace download error:', error);
    return NextResponse.json({ error: 'Failed to generate workspace archive.' }, { status: 500 });
  }
}
