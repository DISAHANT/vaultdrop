import { NextResponse } from 'next/server';
import { getClipData } from '@/lib/pusher';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // First, try the fast in-memory cache
  const memData = getClipData(params.id);
  if (memData) {
    return NextResponse.json({ data: memData });
  }

  // Fallback: look up the clip in the database by its cuid id
  try {
    const clip = await prisma.syncClip.findUnique({
      where: { id: params.id },
      select: { content: true },
    });

    if (clip?.content) {
      return NextResponse.json({ data: clip.content });
    }
  } catch (err) {
    console.error('DB clip lookup error:', err);
  }

  return NextResponse.json({ error: 'Clip not found or expired.' }, { status: 404 });
}
