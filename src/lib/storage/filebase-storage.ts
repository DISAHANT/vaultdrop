import prisma from '@/lib/db';
import crypto from 'crypto';
import type {
  FileInput,
  StorageService,
  StoredFileMetadata,
  StoredFileWithData,
} from './storage-service';
import { putObjectSafe, getObjectBufferSafe, deleteObjectSafe } from './object-storage';

/**
 * Filebase (S3-compatible) & Database Hybrid Object Storage Service.
 * File binaries are securely persisted via S3 cloud storage or high-reliability database LONGBLOB.
 * Works seamlessly across both local development and Vercel serverless environments.
 */
export class FilebaseStorageService implements StorageService {
  async saveFile(shareId: string, file: FileInput): Promise<StoredFileMetadata> {
    const checksum =
      file.checksum || crypto.createHash('sha256').update(file.buffer).digest('hex');
    const sanitizedName = this.sanitizeFilename(file.originalFilename);
    const fileKey = `shares/${shareId}/${Date.now()}-${sanitizedName}`;

    // 1. Attempt object storage write (Filebase S3 cloud upload + local/tmp cache)
    let storageType: 'filebase' | 'local' | 'db' = 'db';
    try {
      const res = await putObjectSafe({
        fileKey,
        buffer: file.buffer,
        contentType: file.mimeType || 'application/octet-stream',
      });
      storageType = res.storage;
    } catch (err) {
      console.warn(`Object storage write warning for ${fileKey}:`, err);
    }

    // 2. Persist record in Prisma.
    // In serverless environments (Vercel) or when S3 is unavailable, we ALWAYS store
    // the binary in database LONGBLOB (fileData) so files survive across ephemeral lambda instances.
    const isServerless = !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.cwd().startsWith('/var/task')
    );
    const shouldSaveInDb = storageType !== 'filebase' || isServerless;

    const record = await prisma.file.create({
      data: {
        shareId,
        originalFilename: sanitizedName,
        mimeType: file.mimeType || 'application/octet-stream',
        fileSize: BigInt(file.fileSize),
        fileKey: fileKey,
        fileData: shouldSaveInDb ? file.buffer : null,
        checksum,
      },
      select: {
        id: true,
        shareId: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        fileKey: true,
        checksum: true,
        createdAt: true,
      },
    });

    return record;
  }

  async saveFiles(shareId: string, files: FileInput[]): Promise<StoredFileMetadata[]> {
    const results: StoredFileMetadata[] = [];
    for (const file of files) {
      const result = await this.saveFile(shareId, file);
      results.push(result);
    }
    return results;
  }

  async getFile(fileId: string): Promise<StoredFileWithData | null> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) return null;

    let buffer: Buffer | null = null;

    // 1. Check database BLOB first (fastest and 100% reliable across serverless)
    if (file.fileData) {
      buffer = Buffer.from(file.fileData);
    } else if (file.fileKey) {
      // 2. Fetch binary from object storage (S3 / local cache)
      buffer = await getObjectBufferSafe(file.fileKey);
    }

    return {
      id: file.id,
      shareId: file.shareId,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      fileKey: file.fileKey,
      checksum: file.checksum,
      createdAt: file.createdAt,
      fileData: buffer,
    };
  }

  async getFileMetadata(fileId: string): Promise<StoredFileMetadata | null> {
    return prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        shareId: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        fileKey: true,
        checksum: true,
        createdAt: true,
      },
    });
  }

  async getShareFilesMetadata(shareId: string): Promise<StoredFileMetadata[]> {
    return prisma.file.findMany({
      where: { shareId },
      select: {
        id: true,
        shareId: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        fileKey: true,
        checksum: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { fileKey: true },
    });

    if (file?.fileKey) {
      await deleteObjectSafe(file.fileKey);
    }

    await prisma.file.delete({ where: { id: fileId } });
  }

  async deleteShareFiles(shareId: string): Promise<void> {
    const files = await prisma.file.findMany({
      where: { shareId },
      select: { fileKey: true },
    });

    for (const f of files) {
      if (f.fileKey) {
        await deleteObjectSafe(f.fileKey);
      }
    }

    await prisma.file.deleteMany({ where: { shareId } });
  }

  async fileExists(fileId: string): Promise<boolean> {
    const count = await prisma.file.count({ where: { id: fileId } });
    return count > 0;
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(0, 255);
  }
}
