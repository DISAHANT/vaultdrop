import { NextResponse } from 'next/server';
import { broadcastClipboardEvent, type SyncClipboardPayload } from '@/lib/pusher';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function isUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      roomId,
      text,
      senderId,
      senderName = 'Anonymous Device',
    } = body as {
      roomId: string;
      text: string;
      senderId: string;
      senderName?: string;
    };

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'Room ID is required.' }, { status: 400 });
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text payload is required.' }, { status: 400 });
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return NextResponse.json({ error: 'Text cannot be empty.' }, { status: 400 });
    }

    const isImage = body.type === 'image' || trimmedText.startsWith('data:image/');

    // Only enforce a limit for images (10MB base64); text content is unlimited
    if (isImage && trimmedText.length > 10000000) {
      return NextResponse.json({ error: 'Image payload exceeds maximum 10MB limit.' }, { status: 413 });
    }

    const payload: SyncClipboardPayload = {
      id: nanoid(10),
      roomId: roomId.toUpperCase().trim(),
      text,
      type: isImage ? 'image' : isUrl(trimmedText) ? 'url' : 'text',
      senderId: senderId || 'anonymous',
      senderName: senderName.slice(0, 50),
      timestamp: Date.now(),
    };

    const { recordClip } = await import('@/lib/services/sync-service');
    const savedClip = await recordClip({
      roomId: payload.roomId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      type: payload.type,
      content: payload.text,
    });
    payload.id = savedClip.id;

    const result = await broadcastClipboardEvent(payload);

    return NextResponse.json({
      success: true,
      payload,
      transport: result.pusherSent ? 'pusher' : 'fallback-sse',
    });
  } catch (error) {
    console.error('Clipboard broadcast error:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast clipboard event.' },
      { status: 500 }
    );
  }
}
