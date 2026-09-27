import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers — Transfer history for the current user.
 * Returns:
 * - uploads: workspaces owned by the user
 * - sent: shares created by the user
 * - received: shares received by the user
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. My uploads (workspaces I own)
    const uploads = await prisma.workspace.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        shareCode: true,
        totalFiles: true,
        totalSize: true,
        workspaceStatus: true,
        packageChecksum: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { shares: true } },
      },
    });

    // 2. Sent shares (workspaces I shared with others)
    const sent = await prisma.workspaceShare.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            totalFiles: true,
            totalSize: true,
            workspaceStatus: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
        recipient: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // 3. Received shares (workspaces shared with me)
    const received = await prisma.workspaceShare.findMany({
      where: {
        OR: [
          { recipientId: user.id },
          { recipientEmail: user.email.toLowerCase() },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            totalFiles: true,
            totalSize: true,
            workspaceStatus: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      uploads: uploads.map((u) => ({
        id: u.id,
        name: u.name,
        shareCode: u.shareCode,
        fileCount: u.totalFiles,
        totalBytes: Number(u.totalSize),
        workspaceStatus: u.workspaceStatus,
        packageChecksum: u.packageChecksum,
        sharesCount: u._count.shares,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      sent: sent.map((s) => ({
        id: s.id,
        workspaceId: s.workspaceId,
        workspaceName: s.workspace.name,
        fileCount: s.workspace.totalFiles,
        totalBytes: Number(s.workspace.totalSize),
        workspaceStatus: s.workspace.workspaceStatus,
        recipientEmail: s.recipientEmail,
        recipientName: s.recipient?.name || null,
        status: s.status,
        downloadCount: s.downloadCount,
        downloadedAt: s.downloadedAt,
        revokedAt: s.revokedAt,
        permission: s.permission,
        message: s.message,
        createdAt: s.createdAt,
        ownerName: s.workspace.owner?.name || s.workspace.owner?.email || 'Unknown',
      })),
      received: received.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        workspaceName: r.workspace.name,
        fileCount: r.workspace.totalFiles,
        totalBytes: Number(r.workspace.totalSize),
        workspaceStatus: r.workspace.workspaceStatus,
        senderEmail: r.sender.email,
        senderName: r.sender.name || null,
        senderAvatar: r.sender.avatarUrl || null,
        status: r.status,
        downloadCount: r.downloadCount,
        downloadedAt: r.downloadedAt,
        permission: r.permission,
        message: r.message,
        createdAt: r.createdAt,
        ownerName: r.workspace.owner?.name || r.workspace.owner?.email || 'Unknown',
      })),
    });
  } catch (error: any) {
    console.error('Fetch transfers error:', error);
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
}
