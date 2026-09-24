import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const devices = await prisma.userDevice.findMany({
      where: { userId: user.id },
      orderBy: { lastSeenAt: 'desc' },
    });

    const now = Date.now();
    const enrichedDevices = devices.map((d) => {
      const diffMs = now - new Date(d.lastSeenAt).getTime();
      let status: 'online' | 'idle' | 'offline' = 'offline';
      if (diffMs < 60 * 1000) {
        status = 'online';
      } else if (diffMs < 5 * 60 * 1000) {
        status = 'idle';
      }

      return {
        ...d,
        computedStatus: status,
      };
    });

    return NextResponse.json({ devices: enrichedDevices });
  } catch (error: any) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}
