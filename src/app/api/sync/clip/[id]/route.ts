import { NextResponse } from 'next/server';
import { getClipData } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = getClipData(params.id);
  if (!data) {
    return NextResponse.json({ error: 'Clip not found or expired.' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
