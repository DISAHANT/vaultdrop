import prisma from '@/lib/db';
import { generateUniqueShareCode } from './token-service';
import type { SessionType, SyncStatus } from '@prisma/client';

export interface CreateSessionOptions {
  type?: 'TEMPORARY' | 'PERMANENT';
  title?: string;
  ownerId?: string | null;
}

export async function createSyncSession(options: CreateSessionOptions = {}) {
  const code = await generateUniqueShareCode();
  const sessionType: SessionType = options.type === 'PERMANENT' ? 'PERMANENT' : 'TEMPORARY';
  const expiresAt =
    sessionType === 'TEMPORARY'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      : null;

  const title =
    options.title && options.title.trim().length > 0
      ? options.title.trim().slice(0, 255)
      : sessionType === 'PERMANENT'
        ? `Permanent Room ${code}`
        : `Live Session ${code}`;

  const session = await prisma.syncSession.create({
    data: {
      code,
      title,
      type: sessionType,
      status: 'ACTIVE',
      ownerId: options.ownerId || null,
      expiresAt,
      lastActiveAt: new Date(),
    },
    select: {
      id: true,
      code: true,
      title: true,
      type: true,
      status: true,
      ownerId: true,
      expiresAt: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });

  return session;
}

export async function getSyncSessionByCode(code: string) {
  const cleanCode = code.toUpperCase().trim();
  const session = await prisma.syncSession.findUnique({
    where: { code: cleanCode },
    include: {
      devices: {
        orderBy: { lastSeenAt: 'desc' },
      },
    },
  });

  if (!session) return null;

  // Check expiration for temporary sessions
  if (
    session.type === 'TEMPORARY' &&
    session.expiresAt &&
    new Date() > session.expiresAt &&
    session.status === 'ACTIVE'
  ) {
    await prisma.syncSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    session.status = 'EXPIRED';
  }

  if (session.status !== 'ACTIVE') {
    return { session, error: `Session is ${session.status.toLowerCase()}` };
  }

  // Update last active
  await prisma.syncSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  // Fetch clips from the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const clips = await prisma.syncClip.findMany({
    where: {
      sessionId: session.id,
      createdAt: { gte: twentyFourHoursAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });

  // Mark devices offline if lastSeenAt > 90 seconds ago
  const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
  const devices = session.devices.map((d) => ({
    ...d,
    isOnline: d.isOnline && d.lastSeenAt >= ninetySecondsAgo,
  }));

  return {
    session: {
      id: session.id,
      code: session.code,
      title: session.title,
      type: session.type,
      status: session.status,
      ownerId: session.ownerId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    },
    clips: clips.map((c) => ({
      id: c.id,
      roomId: session.code,
      text: c.content,
      type: c.type as 'text' | 'url' | 'image',
      senderId: c.senderId,
      senderName: c.senderName,
      timestamp: c.createdAt.getTime(),
    })),
    devices,
  };
}

export async function getUserSyncSessions(userId: string) {
  const sessions = await prisma.syncSession.findMany({
    where: {
      ownerId: userId,
      status: 'ACTIVE',
      OR: [
        { type: 'PERMANENT' },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [{ type: 'desc' }, { lastActiveAt: 'desc' }],
    include: {
      _count: {
        select: {
          clips: true,
          devices: true,
        },
      },
      devices: {
        where: {
          lastSeenAt: { gte: new Date(Date.now() - 90 * 1000) },
        },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    type: s.type,
    status: s.status,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    clipsCount: s._count.clips,
    devicesCount: s._count.devices,
    onlineDevicesCount: s.devices.length,
  }));
}

export async function deleteSyncSession(code: string, userId?: string) {
  const cleanCode = code.toUpperCase().trim();
  const session = await prisma.syncSession.findUnique({
    where: { code: cleanCode },
  });

  if (!session) return false;

  if (userId && session.ownerId && session.ownerId !== userId) {
    throw new Error('Unauthorized to delete this session');
  }

  await prisma.syncSession.delete({
    where: { id: session.id },
  });

  return true;
}

export async function recordClip(options: {
  roomId: string;
  senderId: string;
  senderName: string;
  type: string;
  content: string;
}) {
  const cleanCode = options.roomId.toUpperCase().trim();

  // Find or auto-link session
  let session = await prisma.syncSession.findUnique({
    where: { code: cleanCode },
  });

  if (!session) {
    // If not existing, create a standard temporary session
    session = await prisma.syncSession.create({
      data: {
        code: cleanCode,
        title: `Session ${cleanCode}`,
        type: 'TEMPORARY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  const clip = await prisma.syncClip.create({
    data: {
      sessionId: session.id,
      senderId: options.senderId,
      senderName: options.senderName,
      type: options.type,
      content: options.content,
    },
  });

  await prisma.syncSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  return clip;
}

export async function registerDeviceHeartbeat(options: {
  roomId: string;
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
}) {
  const cleanCode = options.roomId.toUpperCase().trim();
  const session = await prisma.syncSession.findUnique({
    where: { code: cleanCode },
  });

  if (!session) return null;

  // Wrap in try/catch to handle TiDB upsert race condition (P2002)
  try {
    const device = await prisma.syncDevice.upsert({
      where: {
        sessionId_deviceId: {
          sessionId: session.id,
          deviceId: options.deviceId,
        },
      },
      create: {
        sessionId: session.id,
        deviceId: options.deviceId,
        deviceName: options.deviceName.slice(0, 100),
        isOnline: options.isOnline,
        lastSeenAt: new Date(),
      },
      update: {
        deviceName: options.deviceName.slice(0, 100),
        isOnline: options.isOnline,
        lastSeenAt: new Date(),
      },
    });

    return device;
  } catch (err: unknown) {
    // Retry once on unique constraint race condition
    if ((err as { code?: string }).code === 'P2002') {
      const device = await prisma.syncDevice.update({
        where: {
          sessionId_deviceId: {
            sessionId: session.id,
            deviceId: options.deviceId,
          },
        },
        data: {
          deviceName: options.deviceName.slice(0, 100),
          isOnline: options.isOnline,
          lastSeenAt: new Date(),
        },
      });
      return device;
    }
    throw err;
  }
}
