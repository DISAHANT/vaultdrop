import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateUniqueShareCode } from '@/lib/services/token-service';
import { getStorageService } from '@/lib/storage';
import { getExpirationDate, CONFIG } from '@/lib/config';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/auth';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(ip, 'UPLOAD');
    if (!allowed) {
      return NextResponse.json({ error: 'Upload rate limit exceeded. Please wait.' }, { status: 429 });
    }

    const contentType = request.headers.get('content-type') || '';

    // 1. JSON Actions: 'init', 'complete-file', 'complete-share'
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const action = body.action;

      if (action === 'init') {
        const shareCode = await generateUniqueShareCode();
        let passwordHash: string | null = null;
        if (body.password && typeof body.password === 'string' && body.password.trim().length > 0) {
          passwordHash = await bcrypt.hash(body.password, 12);
        }

        const expiresInSeconds = Number(body.expiresInSeconds) || 86400;
        const expiresAt = getExpirationDate(expiresInSeconds);
        const totalFiles = Number(body.totalFiles) || 1;
        const totalSize = BigInt(body.totalSize || 0);

        const sessionUser = await getSessionUser();
        const ownerId = sessionUser?.id || null;

        const share = await prisma.share.create({
          data: {
            shareCode,
            ownerId,
            title: body.title || null,
            description: body.description || null,
            passwordHash,
            expiresAt,
            maxDownloads: Number(body.maxDownloads) || null,
            totalFiles,
            totalSize,
            status: 'ACTIVE',
          },
        });

        const uploadId = nanoid(16);
        return NextResponse.json({
          success: true,
          uploadId,
          shareId: share.id,
          shareCode: share.shareCode,
        });
      }

      if (action === 'complete-file') {
        const { uploadId, shareId, fileIndex, originalFilename, mimeType, fileSize } = body;
        if (!uploadId || !shareId || fileIndex === undefined) {
          return NextResponse.json({ error: 'Missing required metadata' }, { status: 400 });
        }

        // Fetch and assemble all chunks
        const chunks = await prisma.uploadChunk.findMany({
          where: { uploadId, fileIndex: Number(fileIndex) },
          orderBy: { chunkIndex: 'asc' },
        });

        if (chunks.length === 0) {
          return NextResponse.json({ error: 'No chunks found for file' }, { status: 400 });
        }

        const fileBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c.chunkData)));
        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const storage = getStorageService();
        const savedFile = await storage.saveFile(shareId, {
          originalFilename: originalFilename || `file-${fileIndex}`,
          mimeType: mimeType || 'application/octet-stream',
          fileSize: Number(fileSize) || fileBuffer.length,
          buffer: fileBuffer,
          checksum,
        });

        // Clean up chunks for this file
        await prisma.uploadChunk.deleteMany({
          where: { uploadId, fileIndex: Number(fileIndex) },
        });

        return NextResponse.json({ success: true, fileId: savedFile.id });
      }

      if (action === 'complete-share') {
        const { uploadId, shareId } = body;
        if (uploadId) {
          await prisma.uploadChunk.deleteMany({ where: { uploadId } }).catch(() => {});
        }

        const share = await prisma.share.findUnique({
          where: { id: shareId },
          include: { files: true },
        });

        if (!share) {
          return NextResponse.json({ error: 'Share not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          shareCode: share.shareCode,
          title: share.title,
          totalFiles: share.totalFiles,
          totalSize: share.totalSize.toString(),
          url: `${CONFIG.APP_URL}/receive/${share.shareCode}`,
        });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 2. FormData Action: Upload individual chunk (<= 3.5 MB each)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const uploadId = formData.get('uploadId') as string;
      const fileIndex = Number(formData.get('fileIndex') || 0);
      const chunkIndex = Number(formData.get('chunkIndex') || 0);
      const chunkFile = formData.get('chunk') as File | null;

      if (!uploadId || !chunkFile) {
        return NextResponse.json({ error: 'Missing chunk or uploadId' }, { status: 400 });
      }

      const arrayBuffer = await chunkFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upsert chunk in database
      await prisma.uploadChunk.upsert({
        where: {
          uploadId_fileIndex_chunkIndex: {
            uploadId,
            fileIndex,
            chunkIndex,
          },
        },
        create: {
          uploadId,
          fileIndex,
          chunkIndex,
          chunkData: buffer,
        },
        update: {
          chunkData: buffer,
        },
      });

      return NextResponse.json({ success: true, chunkIndex, bytesReceived: buffer.length });
    }

    return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 400 });
  } catch (error: any) {
    console.error('Chunk upload error:', error);
    return NextResponse.json({ error: error?.message || 'Chunk upload failed' }, { status: 500 });
  }
}
