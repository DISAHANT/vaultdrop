import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string | null } | undefined;
    if (!user?.id && !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve user ID
    let userId = user.id;
    if (!userId && user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { id: true },
      });
      if (dbUser) userId = dbUser.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { deviceId, deviceName, deviceType = 'laptop', browser, os } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const device = await prisma.userDevice.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
      create: {
        userId,
        deviceId,
        deviceName: deviceName || 'New Device',
        deviceType,
        browser: browser || null,
        os: os || null,
        isOnline: true,
        lastSeenAt: new Date(),
      },
      update: {
        deviceName: deviceName || undefined,
        deviceType: deviceType || undefined,
        browser: browser || undefined,
        os: os || undefined,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    console.error('Error registering device:', error);
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
  }
}
