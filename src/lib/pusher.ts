import Pusher from 'pusher';
import { EventEmitter } from 'events';

// Global event bus for fallback streaming when Pusher keys are not configured
declare global {
  // eslint-disable-next-line no-var
  var __syncEventEmitter: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __syncClipStore: Map<string, { id: string; data: string; timestamp: number }> | undefined;
}

const syncEventEmitter: EventEmitter =
  global.__syncEventEmitter || (global.__syncEventEmitter = new EventEmitter());
syncEventEmitter.setMaxListeners(200);

const syncClipStore: Map<string, { id: string; data: string; timestamp: number }> =
  global.__syncClipStore || (global.__syncClipStore = new Map());

export function saveClipData(id: string, data: string): void {
  syncClipStore.set(id, { id, data, timestamp: Date.now() });

  // Clean up clips older than 30 minutes
  const threshold = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of syncClipStore.entries()) {
    if (val.timestamp < threshold) {
      syncClipStore.delete(key);
    }
  }
}

export function getClipData(id: string): string | null {
  return syncClipStore.get(id)?.data || null;
}

let pusherServerInstance: Pusher | null = null;

export function isPusherConfigured(): boolean {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  return Boolean(
    appId &&
      key &&
      secret &&
      appId !== 'your_pusher_app_id' &&
      key !== 'your_pusher_key' &&
      secret !== 'your_pusher_secret'
  );
}

export function getPusherServer(): Pusher | null {
  if (!isPusherConfigured()) {
    return null;
  }

  if (!pusherServerInstance) {
    pusherServerInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: (process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY)!,
      secret: process.env.PUSHER_SECRET!,
      cluster: (process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2')!,
      useTLS: true,
    });
  }

  return pusherServerInstance;
}

export interface SyncClipboardPayload {
  id: string;
  roomId: string;
  text: string;
  type: 'text' | 'url' | 'image';
  senderId: string;
  senderName: string;
  timestamp: number;
  clipUrl?: string;
}

/**
 * Broadcasts clipboard sync event across presence & room channels.
 */
export async function broadcastClipboardEvent(payload: SyncClipboardPayload): Promise<{
  pusherSent: boolean;
  sseSent: boolean;
}> {
  const { roomId } = payload;
  let pusherSent = false;

  // If payload is large (like screenshot base64), store it in temporary cache
  if (payload.text.length > 8000 || payload.type === 'image') {
    saveClipData(payload.id, payload.text);
    payload.clipUrl = `/api/sync/clip/${payload.id}`;
  }

  const pusher = getPusherServer();
  if (pusher) {
    try {
      // Pusher limit is 10KB, so send reference for large payloads
      const pusherData: SyncClipboardPayload =
        payload.text.length > 8000
          ? {
              ...payload,
              text: payload.type === 'image' ? '' : payload.text.slice(0, 500) + '...',
              clipUrl: payload.clipUrl,
            }
          : payload;

      await pusher.trigger(
        [`presence-room-${roomId}`, `room-${roomId}`],
        'clipboard-sync',
        pusherData
      );
      pusherSent = true;
    } catch (err) {
      console.warn('Pusher broadcast warning:', err);
    }
  }

  // Always emit full payload to local event emitter for SSE listeners
  syncEventEmitter.emit(`room:${roomId}`, payload);

  return { pusherSent, sseSent: true };
}

export function subscribeToRoomEvents(
  roomId: string,
  callback: (payload: SyncClipboardPayload) => void
): () => void {
  const eventName = `room:${roomId}`;
  syncEventEmitter.on(eventName, callback);
  return () => {
    syncEventEmitter.off(eventName, callback);
  };
}

export { syncEventEmitter };
