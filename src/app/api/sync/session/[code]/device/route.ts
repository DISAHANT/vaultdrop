import { NextResponse } from 'next/server';
import { registerDeviceHeartbeat } from '@/lib/services/sync-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const body = await request.json();
    const { deviceId, deviceName = 'Device', isOnline = true } = body as {
      deviceId: string;
      deviceName?: string;
      isOnline?: boolean;
    };

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const device = await registerDeviceHeartbeat({
      roomId: params.code,
      deviceId,
      deviceName,
      isOnline,
    });

    return NextResponse.json({ success: true, device });
  } catch (error) {
    console.error('Device heartbeat error:', error);
    return NextResponse.json({ error: 'Failed to update device status' }, { status: 500 });
  }
}
