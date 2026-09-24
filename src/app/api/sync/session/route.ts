import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSyncSession, getUserSyncSessions } from '@/lib/services/sync-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const ownerId = (session?.user as { id?: string })?.id || null;

    const body = await request.json().catch(() => ({}));
    const { type = 'TEMPORARY', title = '' } = body as {
      type?: 'TEMPORARY' | 'PERMANENT';
      title?: string;
    };

    const newSession = await createSyncSession({
      type,
      title,
      ownerId,
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create sync session.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ sessions: [] });
    }

    const userSessions = await getUserSyncSessions(userId);
    return NextResponse.json({ sessions: userSessions });
  } catch (error) {
    console.error('Fetch user sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user sessions.' },
      { status: 500 }
    );
  }
}
