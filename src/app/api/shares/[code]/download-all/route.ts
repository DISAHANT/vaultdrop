import { NextResponse } from 'next/server';
import { getShareByCode, recordDownload } from '@/lib/services/share-service';
import { getStorageService } from '@/lib/storage';
import { isExpired } from '@/lib/config';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import archiver from 'archiver';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
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

    // Record download
    const userAgent = request.headers.get('user-agent') || '';
    const result = await recordDownload(share.id, null, ip, userAgent);
    if (!result.allowed) {
      return NextResponse.json({ error: result.reason }, { status: 410 });
    }

    // Create ZIP archive
    const storage = getStorageService();
    const archive = archiver('zip', { zlib: { level: 5 } });

    // Add each file to the archive
    for (const fileMeta of share.files) {
      const file = await storage.getFile(fileMeta.id);
      if (file) {
        archive.append(file.fileData, { name: file.originalFilename });
      }
    }

    // Convert archive to buffer
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks);
    const zipName = (share.title || `VaultDrop-${share.shareCode}`).replace(/[^\w\s\-]/g, '_') + '.zip';

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Download all error:', error);
    return NextResponse.json({ error: 'Download failed.' }, { status: 500 });
  }
}
