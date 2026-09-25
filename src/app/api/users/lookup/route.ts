import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || searchParams.get('email') || '').trim();

    const whereClause: any = {
      NOT: { id: currentUser.id },
    };

    if (query) {
      whereClause.OR = [
        { email: { contains: query.toLowerCase() } },
        { name: { contains: query } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    // If query has an email format, directly check for exact match in database
    let exactMatch = null;
    if (query && query.includes('@')) {
      exactMatch = await prisma.user.findUnique({
        where: { email: query.toLowerCase() },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });
      if (exactMatch?.id === currentUser.id) {
        exactMatch = null;
      }
    } else if (query) {
      exactMatch = users.find((u) => u.email.toLowerCase() === query.toLowerCase()) || null;
    }

    return NextResponse.json({
      users,
      exactMatch,
    });
  } catch (error: any) {
    console.error('User lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up users' }, { status: 500 });
  }
}
