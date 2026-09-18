import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createShare } from '@/lib/services/share-service';
import { createShareSchema, validateFileUpload, validateTotalUpload } from '@/lib/validation';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { CONFIG } from '@/lib/config';
import crypto from 'crypto';
import type { FileInput } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(ip, 'UPLOAD');
    if (!allowed) {
      return NextResponse.json({ error: 'Upload rate limit exceeded. Please wait.' }, { status: 429 });
    }

    const formData = await request.formData();

    // Parse share options
    const title = formData.get('title') as string || '';
    const description = formData.get('description') as string || '';
    const password = formData.get('password') as string || undefined;
    const expiresInSeconds = parseInt(formData.get('expiresInSeconds') as string || '86400');
    const maxDownloads = parseInt(formData.get('maxDownloads') as string || '0');

    const optionsParsed = createShareSchema.safeParse({
      title,
      description,
      password: password || undefined,
      expiresInSeconds,
      maxDownloads,
    });

    if (!optionsParsed.success) {
      return NextResponse.json({ error: optionsParsed.error.errors[0].message }, { status: 400 });
    }

    // Collect files
    const fileEntries = formData.getAll('files').filter((entry): entry is globalThis.File => entry instanceof globalThis.File);

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: 'At least one file is required.' }, { status: 400 });
    }

    // Validate files
    const totalValidation = validateTotalUpload(fileEntries.map(f => ({ size: f.size })));
    if (!totalValidation.valid) {
      return NextResponse.json({ error: totalValidation.error }, { status: 400 });
    }

    // Convert to FileInput
    const files: FileInput[] = [];
    for (const file of fileEntries) {
      const validation = validateFileUpload({ size: file.size, type: file.type, name: file.name });
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      files.push({
        originalFilename: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        buffer,
        checksum,
      });
    }

    // Get session for optional owner assignment
    const session = await getServerSession(authOptions);
    const ownerId = (session?.user as { id?: string })?.id || undefined;

    const share = await createShare({
      ...optionsParsed.data,
      ownerId,
      files,
    });

    return NextResponse.json({
      shareCode: share.shareCode,
      title: share.title,
      totalFiles: share.totalFiles,
      totalSize: share.totalSize.toString(),
      expiresAt: share.expiresAt?.toISOString() || null,
      maxDownloads: share.maxDownloads,
      hasPassword: share.hasPassword,
      url: `${CONFIG.APP_URL}/receive/${share.shareCode}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json({ error: 'Failed to create share.' }, { status: 500 });
  }
}
