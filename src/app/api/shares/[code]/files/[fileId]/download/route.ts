import { NextResponse } from 'next/server';
import { getShareByCode, recordDownload } from '@/lib/services/share-service';
import { getStorageService } from '@/lib/storage';
import { isExpired } from '@/lib/config';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { code: string; fileId: string } }
) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(ip, 'DOWNLOAD');
    if (!allowed) {
      return NextResponse.json({ error: 'Download rate limit exceeded.' }, { status: 429 });
    }

    const share = await getShareByCode(params.code);
    if (!share) {
      return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
    }

    if (share.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Share is ${share.status.toLowerCase()}.` }, { status: 410 });
    }

    if (isExpired(share.expiresAt)) {
      return NextResponse.json({ error: 'Share has expired.' }, { status: 410 });
    }

    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return NextResponse.json({ error: 'Download limit reached.' }, { status: 410 });
    }

    // Find the file in share
    const fileInShare = share.files.find((f) => f.id === params.fileId);
    if (!fileInShare) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    // Get file data via storage abstraction
    const storage = getStorageService();
    const file = await storage.getFile(params.fileId);
    if (!file) {
      return NextResponse.json({ error: 'File data not found.' }, { status: 404 });
    }

    // Record download
    const userAgent = request.headers.get('user-agent') || '';
    const result = await recordDownload(share.id, file.id, ip, userAgent);
    if (!result.allowed) {
      return NextResponse.json({ error: result.reason }, { status: 410 });
    }

    // Return file with proper headers
    const sanitizedFilename = file.originalFilename.replace(/[^\w\s.\-()]/g, '_');

    return new NextResponse(new Uint8Array(file.fileData), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Content-Length': file.fileSize.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed.' }, { status: 500 });
  }
}
