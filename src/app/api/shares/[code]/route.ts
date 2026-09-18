import { NextResponse } from 'next/server';
import { getShareByCode, updateShare, deleteShare, revokeShare } from '@/lib/services/share-service';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(ip, 'LOOKUP');
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    const share = await getShareByCode(params.code);
    if (!share) {
      return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
    }

    return NextResponse.json({
      id: share.id,
      shareCode: share.shareCode,
      title: share.title,
      description: share.description,
      hasPassword: share.hasPassword,
      expiresAt: share.expiresAt?.toISOString() || null,
      maxDownloads: share.maxDownloads,
      downloadCount: share.downloadCount,
      totalFiles: share.totalFiles,
      totalSize: share.totalSize.toString(),
      status: share.status,
      createdAt: share.createdAt.toISOString(),
      files: share.files.map((f) => ({
        id: f.id,
        originalFilename: f.originalFilename,
        mimeType: f.mimeType,
        fileSize: f.fileSize.toString(),
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Share lookup error:', error);
    return NextResponse.json({ error: 'Failed to retrieve share.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const share = await getShareByCode(params.code);
    if (!share) {
      return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
    }

    const userId = (session.user as { id?: string }).id;
    // Allow update only if owner or if no owner
    if (share.id) {
      const fullShare = await (await import('@/lib/db')).default.share.findUnique({
        where: { id: share.id },
        select: { ownerId: true },
      });
      if (fullShare?.ownerId && fullShare.ownerId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();
    const updated = await updateShare(share.id, body);
    return NextResponse.json({ success: true, share: updated });
  } catch (error) {
    console.error('Share update error:', error);
    return NextResponse.json({ error: 'Failed to update share.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const share = await getShareByCode(params.code);
    if (!share) {
      return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
    }

    const userId = (session?.user as { id?: string })?.id;
    const fullShare = await (await import('@/lib/db')).default.share.findUnique({
      where: { id: share.id },
      select: { ownerId: true },
    });

    if (fullShare?.ownerId && fullShare.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'revoke') {
      await revokeShare(share.id);
    } else {
      await deleteShare(share.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Share delete error:', error);
    return NextResponse.json({ error: 'Failed to delete share.' }, { status: 500 });
  }
}
