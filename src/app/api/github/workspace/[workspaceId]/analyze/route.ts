import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { analyzeWorkspaceForCommit } from '@/lib/github/ignore';
import { getObjectBufferSafe } from '@/lib/storage/object-storage';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        files: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Allow owner or shared users with access
    const isOwner = workspace.ownerId === user.id;
    if (!isOwner) {
      const share = await prisma.workspaceShare.findFirst({
        where: {
          workspaceId,
          recipientId: user.id,
        },
      });
      if (!share) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let userOverrides: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body?.userOverrides)) {
        userOverrides = body.userOverrides;
      }
    } catch {}

    // Check if workspace contains a .gitignore
    let gitignoreContent: string | undefined = undefined;
    const gitignoreFile = workspace.files.find(
      (f) => f.relativePath === '.gitignore' || f.filename === '.gitignore'
    );
    if (gitignoreFile && gitignoreFile.fileKey) {
      try {
        const buf = await getObjectBufferSafe(gitignoreFile.fileKey);
        if (buf) {
          gitignoreContent = buf.toString('utf-8');
        }
      } catch (err) {
        console.warn('Could not read workspace .gitignore file:', err);
      }
    }

    // Run deep analysis
    const analysis = analyzeWorkspaceForCommit({
      files: workspace.files.map((f) => ({
        id: f.id,
        relativePath: f.relativePath,
        filename: f.filename,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        fileKey: f.fileKey,
      })),
      gitignoreContent,
      userOverrides,
    });

    // Record audit log
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId,
        operation: 'ANALYZE',
        status: 'success',
        metadata: JSON.stringify({
          totalFiles: analysis.totalFiles,
          includedCount: analysis.includedCount,
          ignoredCount: analysis.ignoredCount,
          hasSecrets: analysis.hasSecrets,
          findingsCount: analysis.securityFindings.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Workspace analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze workspace for GitHub' }, { status: 500 });
  }
}
