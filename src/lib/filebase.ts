import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3ClientInstance: S3Client | null = null;
let corsEnsured = false;

/**
 * Ensures Filebase S3 bucket has CORS enabled for web browser uploads.
 */
export async function ensureBucketCors(): Promise<void> {
  if (corsEnsured) return;
  try {
    const s3 = getFilebaseClient();
    const bucket = getFilebaseBucket();
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'Content-Length'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      })
    );
    corsEnsured = true;
  } catch (err) {
    console.warn('Could not set bucket CORS:', err);
  }
}

/**
 * Returns a configured S3 client for Filebase object storage.
 */
export function getFilebaseClient(): S3Client {
  if (!s3ClientInstance) {
    const key = process.env.FILEBASE_KEY || '';
    const secret = process.env.FILEBASE_SECRET || '';

    s3ClientInstance = new S3Client({
      endpoint: 'https://s3.filebase.io',
      region: 'auto',
      credentials: {
        accessKeyId: key,
        secretAccessKey: secret,
      },
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
}

/**
 * Returns the target bucket name for Filebase.
 */
export function getFilebaseBucket(): string {
  return process.env.FILEBASE_BUCKET || 'vaultdrop';
}

/**
 * Generates a pre-signed URL for client direct upload (PUT).
 * Expiration defaults to 10 minutes (600 seconds).
 */
export async function createPresignedUploadUrl(options: {
  fileKey: string;
  mimeType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  await ensureBucketCors().catch(() => {});
  const s3 = getFilebaseClient();
  const bucket = getFilebaseBucket();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.fileKey,
    ContentType: options.mimeType || 'application/octet-stream',
  });

  return getSignedUrl(s3, command, {
    expiresIn: options.expiresInSeconds || 600,
  });
}

/**
 * Generates a pre-signed temporary URL for client download (GET).
 * Expiration defaults to 60 seconds.
 */
export async function createPresignedDownloadUrl(options: {
  fileKey: string;
  originalFilename: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const s3 = getFilebaseClient();
  const bucket = getFilebaseBucket();
  const sanitizedFilename = options.originalFilename.replace(/[^\w\s.\-()]/g, '_');

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: options.fileKey,
    ResponseContentDisposition: `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(options.originalFilename)}`,
  });

  return getSignedUrl(s3, command, {
    expiresIn: options.expiresInSeconds || 60,
  });
}

/**
 * Deletes a single object from Filebase.
 */
export async function deleteFilebaseObject(fileKey: string): Promise<void> {
  if (!fileKey) return;
  const s3 = getFilebaseClient();
  const bucket = getFilebaseBucket();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });
    await s3.send(command);
  } catch (error) {
    console.error(`Failed to delete object "${fileKey}" from Filebase:`, error);
  }
}

/**
 * Deletes multiple objects from Filebase in batch.
 */
export async function deleteFilebaseObjects(fileKeys: string[]): Promise<void> {
  const validKeys = fileKeys.filter(Boolean);
  if (validKeys.length === 0) return;

  const s3 = getFilebaseClient();
  const bucket = getFilebaseBucket();

  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: validKeys.map((Key) => ({ Key })),
        Quiet: true,
      },
    });
    await s3.send(command);
  } catch (error) {
    console.error('Failed to batch delete objects from Filebase:', error);
  }
}

/**
 * Retrieves an object stream directly from Filebase (useful for zip archiving).
 */
export async function getFilebaseObjectStream(fileKey: string) {
  const s3 = getFilebaseClient();
  const bucket = getFilebaseBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });

  return s3.send(command);
}
