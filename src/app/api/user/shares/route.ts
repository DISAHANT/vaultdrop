import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserShares } from '@/lib/services/share-service';
import type { ShareStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id!;
    const url = new URL(request.url);

    const result = await getUserShares(userId, {
      status: (url.searchParams.get('status') as ShareStatus) || undefined,
      search: url.searchParams.get('search') || undefined,
      sortBy: (url.searchParams.get('sortBy') as 'newest' | 'oldest' | 'downloads') || 'newest',
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '20'),
    });

    // Serialize BigInt
    const serialized = {
      ...result,
      shares: result.shares.map(s => ({
        ...s,
        totalSize: s.totalSize.toString(),
        files: s.files.map(f => ({ ...f, fileSize: f.fileSize.toString() })),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('User shares error:', error);
    return NextResponse.json({ error: 'Failed to fetch shares.' }, { status: 500 });
  }
}
