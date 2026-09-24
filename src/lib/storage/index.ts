import { FilebaseStorageService } from './filebase-storage';
import { DatabaseStorageService } from './database-storage';
import type { StorageService } from './storage-service';

export type { StorageService, FileInput, StoredFileMetadata, StoredFileWithData } from './storage-service';

let storageInstance: StorageService | null = null;

/**
 * Factory function for storage service.
 * Returns FilebaseStorageService (S3-compatible object storage).
 */
export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = new FilebaseStorageService();
  }
  return storageInstance;
}
