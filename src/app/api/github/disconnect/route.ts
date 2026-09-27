import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete or mark active connections as revoked
    const deleted = await prisma.gitHubConnection.deleteMany({
      where: { vaultdropUserId: user.id },
    });

    // Audit log disconnection
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        operation: 'DISCONNECT',
        status: 'success',
        metadata: JSON.stringify({ count: deleted.count }),
      },
    });

    return NextResponse.json({ success: true, message: 'GitHub account disconnected.' });
  } catch (error: any) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect GitHub account' }, { status: 500 });
  }
}
