import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { operationId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { operationId } = params;

    const op = await prisma.gitHubOperation.findFirst({
      where: {
        id: operationId,
        vaultdropUserId: user.id,
      },
    });

    if (!op) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    let parsedMeta = null;
    try {
      if (op.metadata) parsedMeta = JSON.parse(op.metadata);
    } catch {}

    return NextResponse.json({
      operation: {
        id: op.id,
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
      },
    });
  } catch (error: any) {
    console.error('Fetch operation error:', error);
    return NextResponse.json({ error: 'Failed to fetch operation' }, { status: 500 });
  }
}
