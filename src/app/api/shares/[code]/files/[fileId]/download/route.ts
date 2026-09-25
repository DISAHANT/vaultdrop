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

    // Record download
    const userAgent = request.headers.get('user-agent') || '';
    const result = await recordDownload(share.id, fileInShare.id, ip, userAgent);
    if (!result.allowed) {
      return NextResponse.json({ error: result.reason }, { status: 410 });
    }

    const { createPresignedDownloadUrl, getFilebaseObjectStream } = await import('@/lib/filebase');
    const { Readable } = await import('stream');
    const urlObj = new URL(request.url);
    const wantsDirectJson = urlObj.searchParams.get('json') === 'true';

    // If caller explicitly requested direct JSON pre-signed URL
    if (wantsDirectJson && fileInShare.fileKey) {
      const downloadUrl = await createPresignedDownloadUrl({
        fileKey: fileInShare.fileKey,
        originalFilename: fileInShare.originalFilename,
        expiresInSeconds: 60,
      });
      return NextResponse.json({ downloadUrl, filename: fileInShare.originalFilename });
    }

    const sanitizedFilename = fileInShare.originalFilename.replace(/[^\w\s.\-()]/g, '_');
    const encodedFilename = encodeURIComponent(fileInShare.originalFilename);

    // Deliver via direct stream from Filebase
    if (fileInShare.fileKey) {
      try {
        const s3Response = await getFilebaseObjectStream(fileInShare.fileKey);
        if (s3Response.Body) {
          let webStream: ReadableStream;
          if (typeof (s3Response.Body as any).transformToWebStream === 'function') {
            webStream = (s3Response.Body as any).transformToWebStream();
          } else {
            webStream = Readable.toWeb(s3Response.Body as any) as ReadableStream;
          }

          const contentLength = s3Response.ContentLength?.toString() || fileInShare.fileSize.toString();

          return new Response(webStream, {
            headers: {
              'Content-Type': fileInShare.mimeType || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`,
              'Content-Length': contentLength,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Content-Type-Options': 'nosniff',
              'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
            },
          });
        }
      } catch (streamError) {
        console.warn('Direct Filebase stream failed, checking local object storage / DB:', streamError);
        try {
          const { getObjectBufferSafe } = await import('@/lib/storage/object-storage');
          const buf = await getObjectBufferSafe(fileInShare.fileKey);
          if (buf) {
            return new NextResponse(new Uint8Array(buf), {
              headers: {
                'Content-Type': fileInShare.mimeType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`,
                'Content-Length': buf.length.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
              },
            });
          }
        } catch {}

        // Check database fallback before attempting external S3 redirect
        try {
          const storage = getStorageService();
          const dbFile = await storage.getFile(params.fileId);
          if (dbFile && dbFile.fileData) {
            return new NextResponse(new Uint8Array(dbFile.fileData), {
              headers: {
                'Content-Type': dbFile.mimeType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`,
                'Content-Length': dbFile.fileSize.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
              },
            });
          }
        } catch {}

        if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET) {
          try {
            const downloadUrl = await createPresignedDownloadUrl({
              fileKey: fileInShare.fileKey,
              originalFilename: fileInShare.originalFilename,
              expiresInSeconds: 60,
            });
            return NextResponse.redirect(downloadUrl, 302);
          } catch {}
        }
      }
    }

    // Fallback for legacy DB binary blobs
    const storage = getStorageService();
    const file = await storage.getFile(params.fileId);
    if (!file || !file.fileData) {
      return NextResponse.json({ error: 'File data not found.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.fileData), {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': file.fileSize.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed.' }, { status: 500 });
  }
}
