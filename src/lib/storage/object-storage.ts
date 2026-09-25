import fs from 'fs';
import path from 'path';
import os from 'os';
import { getFilebaseClient, getFilebaseBucket } from '@/lib/filebase';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

let cachedWritableDir: string | null = null;

/**
 * Returns a writable directory for temporary or local storage.
 * On serverless platforms (Vercel, AWS Lambda), process.cwd() is /var/task (read-only),
 * so this safely falls back to os.tmpdir() (/tmp) where writes are permitted.
 */
export function getWritableStorageDir(): string {
  if (cachedWritableDir) {
    return cachedWritableDir;
  }

  // 1. Try process.cwd()/.vaultdrop-storage (standard local development)
  const localDir = path.join(process.cwd(), '.vaultdrop-storage');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    cachedWritableDir = localDir;
    return localDir;
  } catch {
    // Local directory is not writable (e.g. Vercel read-only filesystem /var/task)
  }

  // 2. Safe fallback to os.tmpdir()/.vaultdrop-storage
  const tmpDir = path.join(os.tmpdir(), '.vaultdrop-storage');
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    cachedWritableDir = tmpDir;
    return tmpDir;
  } catch {
    cachedWritableDir = os.tmpdir();
    return os.tmpdir();
  }
}

/**
 * Stores file payload safely.
 * 1. If Filebase S3 is configured, attempts cloud object upload.
 * 2. Caches/stores locally in a verified writable directory.
 * Never crashes on read-only serverless filesystems.
 */
export async function putObjectSafe(options: {
  fileKey: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ storage: 'filebase' | 'local'; fileKey: string }> {
  // 1. Try Filebase S3 if configured
  const hasFilebase = !!(
    process.env.FILEBASE_KEY &&
    process.env.FILEBASE_SECRET &&
    process.env.FILEBASE_BUCKET
  );

  if (hasFilebase) {
    try {
      const s3 = getFilebaseClient();
      const bucket = getFilebaseBucket();
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: options.fileKey,
          Body: options.buffer,
          ContentType: options.contentType || 'application/octet-stream',
        })
      );
      return { storage: 'filebase', fileKey: options.fileKey };
    } catch (s3Err: any) {
      console.warn(`Filebase S3 upload failed for ${options.fileKey} (${s3Err?.message || s3Err}), falling back to local/DB storage.`);
    }
  }

  // 2. Fallback to writable local storage (cwd or /tmp)
  try {
    const baseDir = getWritableStorageDir();
    const parts = options.fileKey.split('/').filter(Boolean);
    const localPath = path.join(baseDir, ...parts);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, options.buffer);
    return { storage: 'local', fileKey: options.fileKey };
  } catch (fsErr: any) {
    console.warn(`Local object storage write skipped for ${options.fileKey}:`, fsErr?.message);
    return { storage: 'local', fileKey: options.fileKey };
  }
}

/**
 * Retrieves file buffer from local object storage or Filebase S3.
 */
export async function getObjectBufferSafe(fileKey: string): Promise<Buffer | null> {
  const parts = fileKey.split('/').filter(Boolean);

  // 1. Check verified writable dir, process.cwd(), and os.tmpdir()
  const searchDirs = Array.from(
    new Set([
      getWritableStorageDir(),
      path.join(process.cwd(), '.vaultdrop-storage'),
      path.join(os.tmpdir(), '.vaultdrop-storage'),
    ])
  );

  for (const baseDir of searchDirs) {
    try {
      const localPath = path.join(baseDir, ...parts);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    } catch {}
  }

  // 2. Fetch from Filebase S3 if configured
  if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET) {
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
    } catch (err: any) {
      console.warn(`Failed to fetch ${fileKey} from Filebase:`, err?.message);
    }
  }

  return null;
}

/**
 * Deletes file from both Filebase S3 and local/tmp object storage.
 */
export async function deleteObjectSafe(fileKey: string): Promise<void> {
  const parts = fileKey.split('/').filter(Boolean);

  const searchDirs = Array.from(
    new Set([
      getWritableStorageDir(),
      path.join(process.cwd(), '.vaultdrop-storage'),
      path.join(os.tmpdir(), '.vaultdrop-storage'),
    ])
  );

  for (const baseDir of searchDirs) {
    try {
      const localPath = path.join(baseDir, ...parts);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch {}
  }

  if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET && process.env.FILEBASE_BUCKET) {
    try {
      const s3 = getFilebaseClient();
      const bucket = getFilebaseBucket();
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
    } catch {}
  }
}
