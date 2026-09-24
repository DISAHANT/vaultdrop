import { subscribeToRoomEvents, type SyncClipboardPayload } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

// Track active members per room for the fallback transport
const roomMembersMap = new Map<string, Set<string>>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId')?.toUpperCase().trim();
  const deviceId = searchParams.get('deviceId') || `dev-${Math.random().toString(36).slice(2, 8)}`;

  if (!roomId) {
    return new Response('Missing roomId parameter', { status: 400 });
  }

  // Register member
  if (!roomMembersMap.has(roomId)) {
    roomMembersMap.set(roomId, new Set());
  }
  const members = roomMembersMap.get(roomId)!;
  members.add(deviceId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller might be closed
        }
      };

      // Send initial presence info
      send('presence', {
        roomId,
        memberCount: members.size,
        deviceId,
      });

      // Listen for clipboard events
      const unsubscribe = subscribeToRoomEvents(roomId, (payload: SyncClipboardPayload) => {
        send('clipboard-sync', payload);
      });

      // Heartbeat ping interval
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Cleanup on connection abort
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unsubscribe();
        members.delete(deviceId);
        if (members.size === 0) {
          roomMembersMap.delete(roomId);
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
