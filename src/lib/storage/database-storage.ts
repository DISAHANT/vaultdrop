import prisma from '@/lib/db';
import crypto from 'crypto';
import type {
  FileInput,
  StorageService,
  StoredFileMetadata,
  StoredFileWithData,
} from './storage-service';

/** Database-backed storage — stores file binary as LONGBLOB in MySQL/TiDB */
export class DatabaseStorageService implements StorageService {
  async saveFile(shareId: string, file: FileInput): Promise<StoredFileMetadata> {
    const checksum = file.checksum || crypto.createHash('sha256').update(file.buffer).digest('hex');

    const record = await prisma.file.create({
      data: {
        shareId,
        originalFilename: this.sanitizeFilename(file.originalFilename),
        mimeType: file.mimeType,
        fileSize: BigInt(file.fileSize),
        fileData: file.buffer,
        checksum,
      },
      select: {
        id: true,
        shareId: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
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
    return {
      ...file,
      fileData: file.fileData ? Buffer.from(file.fileData) : null,
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
        checksum: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    await prisma.file.delete({ where: { id: fileId } });
  }

  async deleteShareFiles(shareId: string): Promise<void> {
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
