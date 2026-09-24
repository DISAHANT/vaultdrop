import prisma from '@/lib/db';
import crypto from 'crypto';
import {
  getFilebaseClient,
  getFilebaseBucket,
  deleteFilebaseObject,
  deleteFilebaseObjects,
  getFilebaseObjectStream,
} from '@/lib/filebase';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import type {
  FileInput,
  StorageService,
  StoredFileMetadata,
  StoredFileWithData,
} from './storage-service';

/**
 * Filebase (S3-compatible) Object Storage Service.
 * File binaries are stored in Filebase bucket; metadata stored in MySQL/Prisma.
 */
export class FilebaseStorageService implements StorageService {
  async saveFile(shareId: string, file: FileInput): Promise<StoredFileMetadata> {
    const checksum =
      file.checksum || crypto.createHash('sha256').update(file.buffer).digest('hex');
    const sanitizedName = this.sanitizeFilename(file.originalFilename);
    const fileKey = `shares/${shareId}/${Date.now()}-${sanitizedName}`;

    let uploadSuccess = false;
    // Upload payload to Filebase if credentials and bucket are set
    try {
      const s3 = getFilebaseClient();
      const bucket = getFilebaseBucket();
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimeType || 'application/octet-stream',
        })
      );
      uploadSuccess = true;
    } catch (err) {
      console.warn('Filebase upload failed, using fallback storage:', err);
    }

    const record = await prisma.file.create({
      data: {
        shareId,
        originalFilename: sanitizedName,
        mimeType: file.mimeType,
        fileSize: BigInt(file.fileSize),
        fileKey: uploadSuccess ? fileKey : null,
        fileData: file.buffer,
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
      // Fetch binary from Filebase
      try {
        const response = await getFilebaseObjectStream(file.fileKey);
        if (response.Body) {
          const stream = response.Body as Readable;
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          buffer = Buffer.concat(chunks);
        }
      } catch (err) {
        console.error(`Failed to retrieve file ${file.fileKey} from Filebase:`, err);
      }
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
      await deleteFilebaseObject(file.fileKey);
    }

    await prisma.file.delete({ where: { id: fileId } });
  }

  async deleteShareFiles(shareId: string): Promise<void> {
    const files = await prisma.file.findMany({
      where: { shareId },
      select: { fileKey: true },
    });

    const fileKeys = files.map((f) => f.fileKey).filter((k): k is string => Boolean(k));
    if (fileKeys.length > 0) {
      await deleteFilebaseObjects(fileKeys);
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
