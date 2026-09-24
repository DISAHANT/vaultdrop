import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getExpirationDate, CONFIG } from '@/lib/config';
import { createShareSchema, validateTotalUpload } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 255);
}

interface CompletedFileRecord {
  fileKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      shareCode,
      title = '',
      description = '',
      password,
      expiresInSeconds = 86400,
      maxDownloads = 0,
      files,
    } = body as {
      shareCode: string;
      title?: string;
      description?: string;
      password?: string;
      expiresInSeconds?: number;
      maxDownloads?: number;
      files: CompletedFileRecord[];
    };

    if (!shareCode) {
      return NextResponse.json({ error: 'Share code is required.' }, { status: 400 });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required.' }, { status: 400 });
    }

    if (files.length > CONFIG.MAX_FILES_PER_SHARE) {
      return NextResponse.json(
        { error: `Maximum ${CONFIG.MAX_FILES_PER_SHARE} files allowed.` },
        { status: 400 }
      );
    }

    // Validate options
    const optionsParsed = createShareSchema.safeParse({
      title,
      description,
      password: password || undefined,
      expiresInSeconds,
      maxDownloads,
    });

    if (!optionsParsed.success) {
      return NextResponse.json(
        { error: optionsParsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Validate total files size
    const totalValidation = validateTotalUpload(files.map((f) => ({ size: f.fileSize })));
    if (!totalValidation.valid) {
      return NextResponse.json({ error: totalValidation.error }, { status: 400 });
    }

    // Password hashing
    let passwordHash: string | null = null;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const expiresAt = getExpirationDate(expiresInSeconds);
    const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);

    // Get session for optional owner assignment
    const sessionUser = await getSessionUser();
    const ownerId = sessionUser?.id || null;

    // Database transaction to create Share and File records
    const share = await prisma.$transaction(async (tx) => {
      const createdShare = await tx.share.create({
        data: {
          shareCode: shareCode.toUpperCase(),
          ownerId,
          title: optionsParsed.data.title || null,
          description: optionsParsed.data.description || null,
          passwordHash,
          expiresAt,
          maxDownloads: optionsParsed.data.maxDownloads || null,
          totalFiles: files.length,
          totalSize: BigInt(totalSize),
          status: 'ACTIVE',
        },
      });

      for (const file of files) {
        await tx.file.create({
          data: {
            shareId: createdShare.id,
            originalFilename: sanitizeFilename(file.originalFilename),
            mimeType: file.mimeType || 'application/octet-stream',
            fileSize: BigInt(file.fileSize),
            fileKey: file.fileKey,
            checksum: file.checksum || null,
          },
        });
      }

      return createdShare;
    });

    return NextResponse.json(
      {
        shareCode: share.shareCode,
        title: share.title,
        totalFiles: share.totalFiles,
        totalSize: share.totalSize.toString(),
        expiresAt: share.expiresAt?.toISOString() || null,
        maxDownloads: share.maxDownloads,
        hasPassword: !!passwordHash,
        url: `${CONFIG.APP_URL}/receive/${share.shareCode}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Complete upload registration error:', error);
    return NextResponse.json(
      { error: 'Failed to complete share registration.' },
      { status: 500 }
    );
  }
}
