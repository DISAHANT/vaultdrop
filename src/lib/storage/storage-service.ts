/** Storage abstraction — allows swapping DB storage for S3/R2 later */

export interface FileInput {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  checksum?: string;
}

export interface StoredFileMetadata {
  id: string;
  shareId: string;
  originalFilename: string;
  mimeType: string;
  fileSize: bigint;
  checksum: string | null;
  createdAt: Date;
}

export interface StoredFileWithData extends StoredFileMetadata {
  fileData: Buffer;
}

export interface StorageService {
  saveFile(shareId: string, file: FileInput): Promise<StoredFileMetadata>;
  saveFiles(shareId: string, files: FileInput[]): Promise<StoredFileMetadata[]>;
  getFile(fileId: string): Promise<StoredFileWithData | null>;
  getFileMetadata(fileId: string): Promise<StoredFileMetadata | null>;
  getShareFilesMetadata(shareId: string): Promise<StoredFileMetadata[]>;
  deleteFile(fileId: string): Promise<void>;
  deleteShareFiles(shareId: string): Promise<void>;
  fileExists(fileId: string): Promise<boolean>;
}
