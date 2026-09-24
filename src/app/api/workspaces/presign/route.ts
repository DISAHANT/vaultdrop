import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

interface WorkspaceFilePresignRequest {
  workspaceName: string;
  files: Array<{
    relativePath: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    category?: string;
    isSensitive?: boolean;
  }>;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required to upload workspaces.' }, { status: 401 });
    }

    const body: WorkspaceFilePresignRequest = await request.json();
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json({ error: 'No files provided for workspace.' }, { status: 400 });
    }

    const workspaceId = `ws_${Date.now()}_${nanoid(6)}`;
    
    // Fast in-memory key assignment (instant response for hundreds of files)
    const results = body.files.map((file) => {
      const sanitizedName = file.fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 200);
      const fileKey = `users/${user.id}/workspaces/${workspaceId}/${nanoid(8)}-${sanitizedName}`;

      return {
        relativePath: file.relativePath,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType || 'application/octet-stream',
        category: file.category || 'other',
        isSensitive: !!file.isSensitive,
        fileKey,
        uploadEndpoint: '/api/workspaces/upload-file',
      };
    });

    return NextResponse.json({
      workspaceId,
      files: results,
    });
  } catch (error) {
    console.error('Workspace presign error:', error);
    return NextResponse.json({ error: 'Failed to generate workspace upload session.' }, { status: 500 });
  }
}
