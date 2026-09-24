import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { getObjectBufferSafe } from '@/lib/storage/object-storage';
import archiver from 'archiver';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: {
        files: true,
      },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized.' }, { status: 404 });
    }


    const archive = archiver('zip', { zlib: { level: 4 } });

    for (const file of workspace.files) {
      if (!file.fileKey) continue;
      try {
        const buffer = await getObjectBufferSafe(file.fileKey);
        if (buffer) {
          archive.append(buffer, { name: file.relativePath });
        }
      } catch (err) {
        console.warn(`Could not add ${file.relativePath} to archive:`, err);
      }
    }

    const zipChunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => zipChunks.push(c));

    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(zipChunks);
    const sanitizedName = workspace.name.replace(/[^\w\s\-]/g, '_');

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
      },
    });
  } catch (error) {
    console.error('Workspace download ZIP error:', error);
    return NextResponse.json({ error: 'Failed to generate workspace archive.' }, { status: 500 });
  }
}
