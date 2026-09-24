import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { broadcastUserClipboard } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.clipboardItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Fetch clipboard items error:', error);
    return NextResponse.json({ error: 'Failed to fetch clipboard' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, type = 'text', deviceId, metadata } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    const preview = content.slice(0, 150).replace(/\n/g, ' ');
    const item = await prisma.clipboardItem.create({
      data: {
        userId: user.id,
        content: content.trim(),
        type: type || 'text',
        deviceId: deviceId || null,
        preview,
        category: type || 'text',
      },
    });

    // Realtime broadcast to other connected user devices
    broadcastUserClipboard(user.id, item).catch((err) =>
      console.warn('Clipboard broadcast error:', err)
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Save clipboard item error:', error);
    return NextResponse.json({ error: 'Failed to save clipboard item' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (itemId) {
      await prisma.clipboardItem.deleteMany({
        where: { id: itemId, userId: user.id },
      });
    } else {
      // Clear all
      await prisma.clipboardItem.deleteMany({
        where: { userId: user.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete clipboard item error:', error);
    return NextResponse.json({ error: 'Failed to delete clipboard item' }, { status: 500 });
  }
}
