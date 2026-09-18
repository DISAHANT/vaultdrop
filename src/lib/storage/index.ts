import { DatabaseStorageService } from './database-storage';
import type { StorageService } from './storage-service';

export type { StorageService, FileInput, StoredFileMetadata, StoredFileWithData } from './storage-service';

let storageInstance: StorageService | null = null;

/**
 * Factory function for storage service.
 * Currently returns DatabaseStorageService.
 * To migrate to S3/R2, create ObjectStorageService implementing StorageService
 * and change this factory.
 */
export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = new DatabaseStorageService();
  }
  return storageInstance;
}
