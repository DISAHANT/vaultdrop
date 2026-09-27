import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications — List notifications for the current user.
 * Query params: unreadOnly=true, limit=50
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: user.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { recipientId: user.id, readAt: null },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        workspaceId: n.workspaceId,
        shareId: n.shareId,
        metadata: n.metadata ? (() => { try { return JSON.parse(n.metadata); } catch { return null; } })() : null,
        sender: n.sender
          ? {
              id: n.sender.id,
              name: n.sender.name,
              email: n.sender.email,
              avatarUrl: n.sender.avatarUrl,
            }
          : null,
        isRead: !!n.readAt,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

/**
 * POST /api/notifications/read-all — Mark all notifications as read.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // If body has action='read-all', mark all as read
    if (body.action === 'read-all') {
      await prisma.notification.updateMany({
        where: { recipientId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // If body has notificationId, mark that specific one as read
    if (body.notificationId) {
      const notification = await prisma.notification.findFirst({
        where: { id: body.notificationId, recipientId: user.id },
      });

      if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      await prisma.notification.update({
        where: { id: body.notificationId },
        data: { readAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Update notifications error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
