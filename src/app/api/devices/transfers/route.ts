import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { broadcastDeviceTransfer } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string | null } | undefined;
    if (!user?.id && !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const {
      targetDeviceId,
      targetDeviceName,
      senderDeviceId = 'unknown',
      senderDeviceName = 'My Device',
      title,
      type = 'file',
      content,
      fileKey,
      fileName,
      fileSize,
      mimeType,
    } = body;

    if (!targetDeviceId || !title) {
      return NextResponse.json({ error: 'Target device and title are required' }, { status: 400 });
    }

    const transfer = await prisma.deviceTransfer.create({
      data: {
        senderUserId: userId,
        senderDeviceId,
        senderDeviceName,
        targetDeviceId,
        targetDeviceName: targetDeviceName || null,
        title,
        type,
        content: content || null,
        fileKey: fileKey || null,
        fileName: fileName || null,
        fileSize: fileSize ? BigInt(fileSize) : null,
        mimeType: mimeType || null,
        status: 'pending',
      },
    });

    const serialized = {
      ...transfer,
      fileSize: transfer.fileSize ? transfer.fileSize.toString() : null,
    };

    // Realtime notification to target device
    await broadcastDeviceTransfer(serialized);

    return NextResponse.json({ success: true, transfer: serialized });
  } catch (error: any) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: 'Failed to initiate transfer' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDeviceId = searchParams.get('targetDeviceId');
    const status = searchParams.get('status') || 'pending';

    if (!targetDeviceId) {
      return NextResponse.json({ error: 'Target device ID is required' }, { status: 400 });
    }

    const transfers = await prisma.deviceTransfer.findMany({
      where: {
        targetDeviceId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const serialized = transfers.map(t => ({
      ...t,
      fileSize: t.fileSize ? t.fileSize.toString() : null,
    }));

    return NextResponse.json({ transfers: serialized });
  } catch (error: any) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
}
