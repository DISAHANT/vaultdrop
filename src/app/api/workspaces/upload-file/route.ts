import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { putObjectSafe } from '@/lib/storage/object-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileKey = formData.get('fileKey') as string | null;

    if (!file || !fileKey) {
      return NextResponse.json({ error: 'Missing file or fileKey' }, { status: 400 });
    }

    // Verify key belongs to this user
    if (!fileKey.startsWith(`users/${user.id}/`) && !fileKey.includes(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await putObjectSafe({
      fileKey,
      buffer,
      contentType: file.type || 'application/octet-stream',
    });

    return NextResponse.json({ success: true, fileKey: result.fileKey, storage: result.storage });
  } catch (error: any) {
    console.error('Workspace upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload file to storage.' }, { status: 500 });
  }
}
