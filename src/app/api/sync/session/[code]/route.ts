import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSyncSessionByCode, deleteSyncSession } from '@/lib/services/sync-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const result = await getSyncSessionByCode(params.code);

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid session code. Room does not exist.' },
        { status: 404 }
      );
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 410 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch session error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve sync session.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    await deleteSyncSession(params.code, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete session.' },
      { status: 400 }
    );
  }
}
