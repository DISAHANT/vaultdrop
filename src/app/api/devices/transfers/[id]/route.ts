import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !['accepted', 'declined', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Valid status required' }, { status: 400 });
    }

    const transfer = await prisma.deviceTransfer.update({
      where: { id: params.id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      transfer: {
        ...transfer,
        fileSize: transfer.fileSize ? transfer.fileSize.toString() : null,
      },
    });
  } catch (error: any) {
    console.error('Error updating transfer status:', error);
    return NextResponse.json({ error: 'Failed to update transfer status' }, { status: 500 });
  }
}
