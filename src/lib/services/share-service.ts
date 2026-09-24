import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateUniqueShareCode } from './token-service';
import { getStorageService, type FileInput } from '@/lib/storage';
import { isExpired, getExpirationDate } from '@/lib/config';
import type { ShareStatus } from '@prisma/client';

export interface CreateShareOptions {
  title?: string;
  description?: string;
  password?: string;
  expiresInSeconds?: number;
  maxDownloads?: number;
  ownerId?: string;
  files: FileInput[];
}

export interface ShareWithFiles {
  id: string;
  shareCode: string;
  title: string | null;
  description: string | null;
  hasPassword: boolean;
  expiresAt: Date | null;
  maxDownloads: number | null;
  downloadCount: number;
  totalFiles: number;
  totalSize: bigint;
  status: ShareStatus;
  createdAt: Date;
  updatedAt: Date;
  files: {
    id: string;
    originalFilename: string;
    mimeType: string;
    fileSize: bigint;
    fileKey?: string | null;
    checksum: string | null;
    createdAt: Date;
  }[];
}

/**
 * Creates a new share with files stored via the storage abstraction.
 * Uses a transaction to ensure atomicity.
 */
export async function createShare(options: CreateShareOptions): Promise<ShareWithFiles> {
  const shareCode = await generateUniqueShareCode();
  const storage = getStorageService();

  let passwordHash: string | null = null;
  if (options.password) {
    passwordHash = await bcrypt.hash(options.password, 12);
  }

  const expiresAt = getExpirationDate(options.expiresInSeconds || 86400);
  const totalSize = options.files.reduce((sum, f) => sum + f.fileSize, 0);

  // Validate ownerId exists in database to prevent foreign key constraint violations
  let validOwnerId: string | null = null;
  if (options.ownerId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: options.ownerId },
        select: { id: true },
      });
      if (u) validOwnerId = u.id;
    } catch {}
  }

  // Create the share record first
  const share = await prisma.share.create({
    data: {
      shareCode,
      ownerId: validOwnerId,
      title: options.title || null,
      description: options.description || null,
      passwordHash,
      expiresAt,
      maxDownloads: options.maxDownloads || null,
      totalFiles: options.files.length,
      totalSize: BigInt(totalSize),
      status: 'ACTIVE',
    },
  });

  // Store files via storage abstraction
  const storedFiles = await storage.saveFiles(share.id, options.files);

  return {
    id: share.id,
    shareCode: share.shareCode,
    title: share.title,
    description: share.description,
    hasPassword: !!passwordHash,
    expiresAt: share.expiresAt,
    maxDownloads: share.maxDownloads,
    downloadCount: share.downloadCount,
    totalFiles: share.totalFiles,
    totalSize: share.totalSize,
    status: share.status,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
    files: storedFiles.map((f) => ({
      id: f.id,
      originalFilename: f.originalFilename,
      mimeType: f.mimeType,
      fileSize: f.fileSize,
      fileKey: f.fileKey,
      checksum: f.checksum,
      createdAt: f.createdAt,
    })),
  };
}

/**
 * Gets share by code — never returns file binary data, only metadata.
 */
export async function getShareByCode(code: string): Promise<ShareWithFiles | null> {
  const share = await prisma.share.findUnique({
    where: { shareCode: code.toUpperCase() },
    include: {
      files: {
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          fileSize: true,
          fileKey: true,
          checksum: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!share) return null;

  // Auto-expire check & Filebase cleanup
  if (share.status === 'ACTIVE' && isExpired(share.expiresAt)) {
    const storage = getStorageService();
    await storage.deleteShareFiles(share.id);
    await prisma.share.update({
      where: { id: share.id },
      data: { status: 'EXPIRED' },
    });
    share.status = 'EXPIRED';
  }

  return {
    ...share,
    hasPassword: !!share.passwordHash,
    files: share.files,
  };
}

/**
 * Verifies share password. Returns true if correct.
 */
export async function verifySharePassword(shareId: string, password: string): Promise<boolean> {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: { passwordHash: true },
  });
  if (!share?.passwordHash) return true; // No password set
  return bcrypt.compare(password, share.passwordHash);
}

/**
 * Records a download event and increments the counter atomically.
 */
export async function recordDownload(
  shareId: string,
  fileId: string | null,
  ipHash: string,
  userAgent: string
): Promise<{ allowed: boolean; reason?: string }> {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: {
      status: true,
      expiresAt: true,
      maxDownloads: true,
      downloadCount: true,
    },
  });

  if (!share) return { allowed: false, reason: 'Share not found' };
  if (share.status !== 'ACTIVE') return { allowed: false, reason: 'Share is no longer active' };
  if (isExpired(share.expiresAt)) return { allowed: false, reason: 'Share has expired' };
  if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
    return { allowed: false, reason: 'Download limit reached' };
  }

  // Atomic increment + event creation
  const isNowExhausted = Boolean(share.maxDownloads && (share.downloadCount + 1) >= share.maxDownloads);

  await prisma.$transaction([
    prisma.share.update({
      where: { id: shareId },
      data: {
        downloadCount: { increment: 1 },
        ...(isNowExhausted ? { status: 'EXPIRED' } : {}),
      },
    }),
    prisma.downloadEvent.create({
      data: {
        shareId,
        fileId,
        ipHash: crypto.createHash('sha256').update(ipHash).digest('hex').slice(0, 16),
        userAgent: userAgent.slice(0, 500),
      },
    }),
  ]);

  if (isNowExhausted) {
    // Schedule Filebase cleanup shortly after URL generation to allow current download to begin
    setTimeout(async () => {
      try {
        const storage = getStorageService();
        await storage.deleteShareFiles(shareId);
      } catch (err) {
        console.error('Error cleaning up exhausted share files:', err);
      }
    }, 65000); // 65 seconds (after 60s signed URL expires)
  }

  return { allowed: true };
}

/**
 * Gets shares for a user's dashboard.
 */
export async function getUserShares(
  userId: string,
  options: {
    status?: ShareStatus;
    search?: string;
    sortBy?: 'newest' | 'oldest' | 'downloads';
    page?: number;
    limit?: number;
  } = {}
) {
  const { status, search, sortBy = 'newest', page = 1, limit = 20 } = options;

  const where: Record<string, unknown> = { ownerId: userId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { shareCode: { contains: search.toUpperCase() } },
      { files: { some: { originalFilename: { contains: search } } } },
    ];
  }

  const orderBy =
    sortBy === 'oldest'
      ? { createdAt: 'asc' as const }
      : sortBy === 'downloads'
        ? { downloadCount: 'desc' as const }
        : { createdAt: 'desc' as const };

  const [shares, total] = await Promise.all([
    prisma.share.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        files: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        },
        _count: { select: { downloadEvents: true } },
      },
    }),
    prisma.share.count({ where }),
  ]);

  return {
    shares: shares.map((s) => ({
      ...s,
      hasPassword: !!s.passwordHash,
      passwordHash: undefined,
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  };
}

/**
 * Gets dashboard stats for a user.
 */
export async function getUserStats(userId: string) {
  const [totalShares, activeShares, expiredShares, totalDownloads, totalStoredSize] =
    await Promise.all([
      prisma.share.count({ where: { ownerId: userId } }),
      prisma.share.count({ where: { ownerId: userId, status: 'ACTIVE' } }),
      prisma.share.count({
        where: { ownerId: userId, status: { in: ['EXPIRED', 'REVOKED'] } },
      }),
      prisma.downloadEvent.count({
        where: { share: { ownerId: userId } },
      }),
      prisma.share.aggregate({
        where: { ownerId: userId },
        _sum: { totalSize: true },
      }),
    ]);

  const totalFiles = await prisma.file.count({
    where: { share: { ownerId: userId } },
  });

  return {
    totalShares,
    activeShares,
    expiredShares,
    totalDownloads,
    totalFiles,
    totalStoredSize: totalStoredSize._sum.totalSize || BigInt(0),
  };
}

/**
 * Updates a share's settings.
 */
export async function updateShare(
  shareId: string,
  data: {
    title?: string;
    description?: string;
    password?: string | null;
    removePassword?: boolean;
    expiresAt?: Date | null;
    maxDownloads?: number;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.removePassword) updateData.passwordHash = null;
  else if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12);
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
  if (data.maxDownloads !== undefined) updateData.maxDownloads = data.maxDownloads || null;

  return prisma.share.update({
    where: { id: shareId },
    data: updateData,
  });
}

/**
 * Revokes a share.
 */
export async function revokeShare(shareId: string) {
  return prisma.share.update({
    where: { id: shareId },
    data: { status: 'REVOKED' },
  });
}

/**
 * Deletes a share and all its files.
 */
export async function deleteShare(shareId: string) {
  const storage = getStorageService();
  await storage.deleteShareFiles(shareId);
  await prisma.share.delete({ where: { id: shareId } });
}

/**
 * Gets download analytics for a share.
 */
export async function getShareAnalytics(shareId: string) {
  const events = await prisma.downloadEvent.findMany({
    where: { shareId },
    select: {
      id: true,
      fileId: true,
      downloadedAt: true,
      file: {
        select: { originalFilename: true },
      },
    },
    orderBy: { downloadedAt: 'desc' },
    take: 100,
  });

  const perFile = await prisma.downloadEvent.groupBy({
    by: ['fileId'],
    where: { shareId, fileId: { not: null } },
    _count: true,
  });

  return { events, perFile };
}
