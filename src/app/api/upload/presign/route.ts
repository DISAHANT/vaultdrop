import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { validateFileUpload } from '@/lib/validation';
import { CONFIG } from '@/lib/config';
import { generateUniqueShareCode } from '@/lib/services/token-service';
import { createPresignedUploadUrl } from '@/lib/filebase';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 255);
}

interface SingleFileRequest {
  filename: string;
  fileSize: number;
  mimeType: string;
  code?: string;
}

interface BatchFileRequest {
  files: Array<{
    filename: string;
    fileSize: number;
    mimeType: string;
  }>;
  code?: string;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(ip, 'UPLOAD');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Please wait.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Support both single file and batch array
    if (body.files && Array.isArray(body.files)) {
      const batch = body as BatchFileRequest;
      if (batch.files.length === 0) {
        return NextResponse.json({ error: 'No files provided.' }, { status: 400 });
      }

      if (batch.files.length > CONFIG.MAX_FILES_PER_SHARE) {
        return NextResponse.json(
          { error: `Maximum ${CONFIG.MAX_FILES_PER_SHARE} files allowed.` },
          { status: 400 }
        );
      }

      const shareCode = batch.code ? batch.code.toUpperCase() : await generateUniqueShareCode();
      const results = [];

      for (const file of batch.files) {
        const validation = validateFileUpload({
          size: file.fileSize,
          type: file.mimeType,
          name: file.filename,
        });

        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const safeName = sanitizeFilename(file.filename);
        const fileKey = `shares/${shareCode}/${Date.now()}-${nanoid(8)}-${safeName}`;
        const presignedUrl = await createPresignedUploadUrl({
          fileKey,
          mimeType: file.mimeType,
          expiresInSeconds: 600, // 10 minutes
        });

        results.push({
          presignedUrl,
          fileKey,
          filename: file.filename,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        });
      }

      return NextResponse.json({
        shareCode,
        files: results,
      });
    }

    // Single file presign
    const single = body as SingleFileRequest;
    if (!single.filename || typeof single.fileSize !== 'number') {
      return NextResponse.json(
        { error: 'Missing required file metadata: filename, fileSize, mimeType.' },
        { status: 400 }
      );
    }

    const validation = validateFileUpload({
      size: single.fileSize,
      type: single.mimeType || 'application/octet-stream',
      name: single.filename,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const shareCode = single.code ? single.code.toUpperCase() : await generateUniqueShareCode();
    const safeName = sanitizeFilename(single.filename);
    const fileKey = `shares/${shareCode}/${Date.now()}-${nanoid(8)}-${safeName}`;

    const presignedUrl = await createPresignedUploadUrl({
      fileKey,
      mimeType: single.mimeType || 'application/octet-stream',
      expiresInSeconds: 600, // 10 minutes
    });

    return NextResponse.json({
      shareCode,
      presignedUrl,
      fileKey,
      filename: single.filename,
      fileSize: single.fileSize,
      mimeType: single.mimeType || 'application/octet-stream',
    });
  } catch (error) {
    console.error('Presign generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate pre-signed upload URL.' },
      { status: 500 }
    );
  }
}
