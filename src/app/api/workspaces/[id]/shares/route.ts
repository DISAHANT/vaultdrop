import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shares = await prisma.workspaceShare.findMany({
      where: { workspaceId: params.id },
      include: {
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ shares });
  } catch (error: any) {
    console.error('Fetch workspace shares error:', error);
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
  }
}

import { sendShareNotificationEmail } from '@/lib/email';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const rawEmails: string[] = Array.isArray(body.recipientEmails)
      ? body.recipientEmails
      : body.recipientEmail
      ? [body.recipientEmail]
      : [];

    const permission = body.permission || 'download';
    const message = (body.message || '').trim().slice(0, 500);

    const validEmails = Array.from(
      new Set(
        rawEmails
          .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter((e) => e && e.includes('@') && e !== user.email.toLowerCase())
      )
    );

    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: 'Please select or enter at least one valid recipient email.' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://vaultdrop.app';
    const shareUrl = `${appUrl}/workspaces/share/${workspace.shareCode}`;

    const createdShares: any[] = [];
    const emailResults: Array<{ email: string; success: boolean; simulated?: boolean }> = [];

    for (const recipientEmail of validEmails) {
      // Check if recipient is a registered user in our application
      const matchedUser = await prisma.user.findUnique({
        where: { email: recipientEmail },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });

      // Upsert share record
      const existingShare = await prisma.workspaceShare.findFirst({
        where: {
          workspaceId: workspace.id,
          recipientEmail,
        },
      });

      let shareRecord;
      if (existingShare) {
        shareRecord = await prisma.workspaceShare.update({
          where: { id: existingShare.id },
          data: {
            recipientId: matchedUser?.id || null,
            permission,
            status: 'sent',
            message: message || existingShare.message,
          },
          include: {
            recipient: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        });
      } else {
        shareRecord = await prisma.workspaceShare.create({
          data: {
            workspaceId: workspace.id,
            senderId: user.id,
            recipientEmail,
            recipientId: matchedUser?.id || null,
            permission,
            status: 'sent',
            message: message || null,
          },
          include: {
            recipient: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        });
      }

      createdShares.push(shareRecord);

      // Dispatch transactional notification email
      const emailRes = await sendShareNotificationEmail({
        recipientEmail,
        recipientName: matchedUser?.name || null,
        senderName: user.name || user.email.split('@')[0],
        senderEmail: user.email,
        workspaceName: workspace.name,
        fileCount: workspace.totalFiles,
        totalBytes: Number(workspace.totalSize),
        message: message || null,
        shareUrl,
      });

      emailResults.push({
        email: recipientEmail,
        success: emailRes.success,
        simulated: emailRes.simulated,
      });
    }

    return NextResponse.json({
      success: true,
      shares: createdShares,
      share: createdShares[0] || null,
      count: createdShares.length,
      shareCode: workspace.shareCode,
      shareUrl,
      emailResults,
    });
  } catch (error: any) {
    console.error('Create workspace share error:', error);
    return NextResponse.json({ error: error.message || 'Failed to share workspace' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');
    if (!shareId) {
      return NextResponse.json({ error: 'Missing shareId' }, { status: 400 });
    }

    const share = await prisma.workspaceShare.findUnique({
      where: { id: shareId },
      include: { workspace: true },
    });

    if (!share || share.workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized or share not found' }, { status: 403 });
    }

    await prisma.workspaceShare.delete({
      where: { id: shareId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete workspace share error:', error);
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 });
  }
}
