import { NextResponse } from 'next/server';
import { verifySharePassword, getShareByCode } from '@/lib/services/share-service';
import { verifyPasswordSchema } from '@/lib/validation';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(ip, 'PASSWORD');
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
    }

    const share = await getShareByCode(params.code);
    if (!share) {
      return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
    }

    if (!share.hasPassword) {
      return NextResponse.json({ verified: true });
    }

    const body = await request.json();
    const parsed = verifyPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const isValid = await verifySharePassword(share.id, parsed.data.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 403 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('Password verification error:', error);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
