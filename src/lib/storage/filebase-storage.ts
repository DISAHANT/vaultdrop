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
 * Filebase (S3-compatible) & Local High-Performance Object Storage Service.
 * File binaries are securely persisted via safe object storage (SSD local fallback + S3 replication);
 * metadata is stored in MySQL/Prisma.
 */
export class FilebaseStorageService implements StorageService {
  async saveFile(shareId: string, file: FileInput): Promise<StoredFileMetadata> {
    const checksum =
      file.checksum || crypto.createHash('sha256').update(file.buffer).digest('hex');
    const sanitizedName = this.sanitizeFilename(file.originalFilename);
    const fileKey = `shares/${shareId}/${Date.now()}-${sanitizedName}`;

    // Safely store file payload (sub-millisecond SSD write + optional S3 replication)
    await putObjectSafe({
      fileKey,
      buffer: file.buffer,
      contentType: file.mimeType || 'application/octet-stream',
    });

    const record = await prisma.file.create({
      data: {
        shareId,
        originalFilename: sanitizedName,
        mimeType: file.mimeType || 'application/octet-stream',
        fileSize: BigInt(file.fileSize),
        fileKey: fileKey,
        fileData: null, // Binary is securely stored in object storage
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

    // Check if legacy DB BLOB exists
    if (file.fileData) {
      buffer = Buffer.from(file.fileData);
    } else if (file.fileKey) {
      // Fetch binary from safe object storage (SSD local fallback + S3 replication)
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
