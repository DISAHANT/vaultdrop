import crypto from 'crypto';
import prisma from '@/lib/db';
import { getGitHubAppConfig } from './app';

/**
 * Verifies GitHub webhook signature using HMAC SHA-256
 */
export function verifyWebhookSignature(payload: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const { webhookSecret } = getGitHubAppConfig();
  if (!webhookSecret) return false;

  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

/**
 * Processes incoming GitHub webhook events with idempotency guarantees
 */
export async function processWebhookEvent(options: {
  deliveryId: string;
  eventType: string;
  payload: any;
  rawBody: string;
}): Promise<{ processed: boolean; duplicate: boolean; message: string }> {
  const { deliveryId, eventType, payload, rawBody } = options;

  // 1. Check idempotency: Return if this delivery was already handled
  const existing = await prisma.gitHubWebhookEvent.findUnique({
    where: { deliveryId },
  });

  if (existing) {
    return {
      processed: false,
      duplicate: true,
      message: 'Delivery already processed.',
    };
  }

  // Calculate payload hash
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const repositoryId = payload.repository?.id ? Number(payload.repository.id) : null;
  const action = payload.action || null;

  // Record initial receipt
  const eventRecord = await prisma.gitHubWebhookEvent.create({
    data: {
      deliveryId,
      eventType,
      action,
      repositoryId,
      payloadHash,
      status: 'received',
    },
  });

  try {
    // 2. Handle specific event types

    // Event: installation (created, deleted, suspend, unsuspend)
    if (eventType === 'installation') {
      const installationId = payload.installation?.id;
      if (installationId) {
        if (action === 'deleted') {
          await prisma.gitHubConnection.updateMany({
            where: { githubInstallationId: installationId },
            data: { status: 'revoked' },
          });
        } else if (action === 'created' || action === 'unsuspend') {
          await prisma.gitHubConnection.updateMany({
            where: { githubInstallationId: installationId },
            data: { status: 'active' },
          });
        }
      }
    }

    // Event: push
    if (eventType === 'push') {
      const repoId = payload.repository?.id;
      const headCommitSha = payload.after || payload.head_commit?.id;

      if (repoId && headCommitSha && headCommitSha !== '0000000000000000000000000000000000000000') {
        await prisma.workspaceGitHubRepo.updateMany({
          where: { repositoryId: repoId },
          data: {
            lastCommitSha: headCommitSha,
            lastSyncAt: new Date(),
          },
        });
      }
    }

    // Mark event as processed
    await prisma.gitHubWebhookEvent.update({
      where: { id: eventRecord.id },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    });

    return {
      processed: true,
      duplicate: false,
      message: 'Event processed successfully.',
    };
  } catch (err: any) {
    console.error(`Failed to process webhook event [${eventType}/${deliveryId}]:`, err);
    await prisma.gitHubWebhookEvent.update({
      where: { id: eventRecord.id },
      data: {
        status: 'failed',
        errorMessage: err?.message || 'Processing failed',
      },
    });

    return {
      processed: false,
      duplicate: false,
      message: err?.message || 'Processing failed',
    };
  }
}
