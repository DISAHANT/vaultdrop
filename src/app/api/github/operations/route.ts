import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '30', 10));

    const operations = await prisma.gitHubOperation.findMany({
      where: {
        vaultdropUserId: user.id,
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      operations: operations.map((op) => {
        let parsedMeta = null;
        try {
          if (op.metadata) parsedMeta = JSON.parse(op.metadata);
        } catch {}

        return {
          id: op.id,
          workspaceId: op.workspaceId,
          operation: op.operation,
          status: op.status,
          repositoryName: op.repositoryName,
          commitSha: op.commitSha,
          filesChanged: op.filesChanged,
          errorCode: op.errorCode,
          errorMessage: op.errorMessage,
          startedAt: op.startedAt,
          completedAt: op.completedAt,
          metadata: parsedMeta,
        };
      }),
    });
  } catch (error: any) {
    console.error('Fetch operations list error:', error);
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}
