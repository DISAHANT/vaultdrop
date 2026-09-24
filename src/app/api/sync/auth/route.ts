import { NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      return NextResponse.json(
        { error: 'Pusher is not configured on the server.' },
        { status: 503 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let socketId = '';
    let channelName = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      socketId = (formData.get('socket_id') as string) || '';
      channelName = (formData.get('channel_name') as string) || '';
    } else {
      const body = await request.json().catch(() => ({}));
      socketId = body.socket_id || '';
      channelName = body.channel_name || '';
    }

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'socket_id and channel_name are required.' },
        { status: 400 }
      );
    }

    const userId = `device-${nanoid(6)}`;
    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: userId,
      user_info: {
        name: `Device ${userId.slice(-4)}`,
        joinedAt: Date.now(),
      },
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json({ error: 'Pusher authorization failed.' }, { status: 500 });
  }
}
