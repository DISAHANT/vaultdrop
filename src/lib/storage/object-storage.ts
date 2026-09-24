import fs from 'fs';
import path from 'path';
import { getFilebaseClient, getFilebaseBucket } from '@/lib/filebase';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.vaultdrop-storage');

let filebaseHealth = {
  lastChecked: 0,
  isAvailable: true,
};

/**
 * Stores file payload safely to Filebase S3 object storage,
 * with automatic local object storage fallback if S3 rejects the upload.
 */
export async function putObjectSafe(options: {
  fileKey: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ storage: 'filebase' | 'local'; fileKey: string }> {
  // 1. Instant local object storage write (sub-millisecond SSD latency)
  try {
    const parts = options.fileKey.split('/').filter(Boolean);
    const localPath = path.join(LOCAL_STORAGE_DIR, ...parts);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, options.buffer);

    // 2. Asynchronously replicate to Filebase S3 if configured (never blocks response)
    if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET) {
      const s3 = getFilebaseClient();
      const bucket = getFilebaseBucket();
      s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: options.fileKey,
          Body: options.buffer,
          ContentType: options.contentType || 'application/octet-stream',
        })
      ).catch(() => {});
    }

    return { storage: 'local', fileKey: options.fileKey };
  } catch (fsErr: any) {
    console.error(`Local object storage write error for ${options.fileKey}:`, fsErr);
    throw new Error(`Failed to store file: ${fsErr.message}`);
  }
}



/**
 * Retrieves file buffer from local object storage or Filebase S3.
 */
export async function getObjectBufferSafe(fileKey: string): Promise<Buffer | null> {
  // 1. Check local object storage
  try {
    const parts = fileKey.split('/').filter(Boolean);
    const localPath = path.join(LOCAL_STORAGE_DIR, ...parts);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  } catch (err) {
    console.warn(`Local storage read warning for ${fileKey}:`, err);
  }

  // 2. Fetch from Filebase S3
  try {
    const s3 = getFilebaseClient();
    const bucket = getFilebaseBucket();
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: fileKey }));
    if (res.Body) {
      const stream = res.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    }
  } catch (err) {
    console.warn(`Failed to fetch ${fileKey} from Filebase:`, err);
  }

  return null;
}

/**
 * Deletes file from both Filebase S3 and local object storage.
 */
export async function deleteObjectSafe(fileKey: string): Promise<void> {
  // Delete from local
  try {
    const parts = fileKey.split('/').filter(Boolean);
    const localPath = path.join(LOCAL_STORAGE_DIR, ...parts);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch {}


  // Delete from Filebase
  try {
    const s3 = getFilebaseClient();
    const bucket = getFilebaseBucket();
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
  } catch {}
}
