import { NextResponse } from 'next/server';
import { verifyWebhookSignature, processWebhookEvent } from '@/lib/github/webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const deliveryId = request.headers.get('x-github-delivery');
    const eventType = request.headers.get('x-github-event');

    if (!deliveryId || !eventType) {
      return NextResponse.json(
        { error: 'Missing GitHub delivery ID or event header' },
        { status: 400 }
      );
    }

    // 1. Validate signature using HMAC SHA-256
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn(`Unauthorized webhook delivery attempt [${deliveryId}]`);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // 2. Process event with idempotency
    const result = await processWebhookEvent({
      deliveryId,
      eventType,
      payload,
      rawBody,
    });

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      processed: result.processed,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Webhook route error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
