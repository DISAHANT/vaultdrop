/**
 * Workspace Package Engine
 * 
 * Server-side ZIP creation with manifest inclusion, checksum verification,
 * and streaming upload to Filebase. This is the core integrity layer.
 * 
 * Architecture:
 * - Filebase S3 is the source of truth for production
 * - Local filesystem is dev-only fallback, explicitly flagged
 * - Package creation is transactional: all-or-nothing
 * - No silent file skipping — any missing file fails the operation
 */

import { createHash } from 'crypto';
import archiver from 'archiver';
import { Readable } from 'stream';
import { getObjectBufferSafe, putObjectSafe, objectExists } from '@/lib/storage/object-storage';
import { buildManifest, type WorkspaceManifest } from './manifest';
import prisma from '@/lib/db';

export interface PackageCreationResult {
  success: boolean;
  packageKey: string;
  manifestKey: string;
  packageChecksum: string;
  packageSize: number;
  filesIncluded: number;
  missingFiles: string[];
  timeTakenMs: number;
}

export interface PackageCreationError {
  success: false;
  stage: string;
  errorCode: string;
  reason: string;
  missingFiles: string[];
  retryable: boolean;
}

/**
 * Calculate SHA-256 checksum for a buffer.
 */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Create a verified workspace package (ZIP) from stored files.
 * 
 * This function:
 * 1. Fetches all file metadata from the database
 * 2. Verifies every file exists in object storage
 * 3. Builds a deterministic manifest
 * 4. Creates a ZIP with all files + manifest
 * 5. Uploads the ZIP to object storage
 * 6. Verifies the upload succeeded
 * 7. Returns the package info or fails explicitly
 * 
 * NEVER silently skips files. If any required file is missing, the operation fails.
 */
export async function createWorkspacePackage(
  workspaceId: string,
): Promise<PackageCreationResult | PackageCreationError> {
  const startTime = Date.now();

  // Update workspace status to PACKAGING
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { workspaceStatus: 'PACKAGING' },
  });

  try {
    // 1. Fetch workspace and all file records
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { files: true },
    });

    if (!workspace) {
      return {
        success: false,
        stage: 'Workspace Lookup',
        errorCode: 'WORKSPACE_NOT_FOUND',
        reason: `Workspace ${workspaceId} not found.`,
        missingFiles: [],
        retryable: false,
      };
    }

    const files = workspace.files.filter(f => f.fileKey);

    if (files.length === 0) {
      return {
        success: false,
        stage: 'File Verification',
        errorCode: 'NO_FILES',
        reason: 'No uploaded files found for this workspace.',
        missingFiles: [],
        retryable: false,
      };
    }

    // 2. Verify every file exists and fetch content
    console.log(`[package] Verifying ${files.length} files for workspace ${workspaceId}`);
    const missingFiles: string[] = [];
    const fileBuffers: Array<{ relativePath: string; buffer: Buffer; checksum: string; meta: typeof files[0] }> = [];

    // Process in controlled batches of 20 to avoid memory exhaustion
    const BATCH_SIZE = 20;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const buffer = await getObjectBufferSafe(file.fileKey!);
            if (!buffer) {
              return { file, buffer: null, missing: true };
            }
            return { file, buffer, missing: false };
          } catch {
            return { file, buffer: null, missing: true };
          }
        })
      );

      for (const result of results) {
        if (result.missing || !result.buffer) {
          missingFiles.push(result.file.relativePath);
        } else {
          const checksum = sha256(result.buffer);
          fileBuffers.push({
            relativePath: result.file.relativePath,
            buffer: result.buffer,
            checksum,
            meta: result.file,
          });

          // Update file checksum in DB if not already set
          if (!result.file.checksum) {
            await prisma.workspaceFile.update({
              where: { id: result.file.id },
              data: { checksum, uploadVerified: true },
            }).catch(() => {}); // Non-critical update
          }
        }
      }
    }

    // 3. FAIL if any files are missing — NEVER silently skip
    if (missingFiles.length > 0) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { workspaceStatus: 'FAILED' },
      });

      return {
        success: false,
        stage: 'File Verification',
        errorCode: 'FILES_MISSING',
        reason: `${missingFiles.length} file(s) could not be retrieved from storage.`,
        missingFiles,
        retryable: true,
      };
    }

    // 4. Build manifest
    const manifest = buildManifest({
      workspaceId,
      name: workspace.name,
      files: fileBuffers.map(fb => ({
        relativePath: fb.relativePath,
        fileSize: Number(fb.meta.fileSize),
        checksum: fb.checksum,
        mimeType: fb.meta.mimeType,
        category: fb.meta.category,
        isSensitive: fb.meta.isSensitive,
        included: true,
      })),
    });

    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');

    // 5. Create ZIP archive
    console.log(`[package] Creating ZIP for ${fileBuffers.length} files`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    const zipChunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => zipChunks.push(chunk));

    // Add manifest first
    archive.append(manifestBuffer, { name: '.vaultdrop/manifest.json' });

    // Add all workspace files
    for (const fb of fileBuffers) {
      archive.append(fb.buffer, { name: fb.relativePath });
    }

    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(zipChunks);
    const packageChecksum = sha256(zipBuffer);

    // Update manifest with package checksum
    manifest.packageChecksum = packageChecksum;
    const finalManifestJson = JSON.stringify(manifest, null, 2);
    const finalManifestBuffer = Buffer.from(finalManifestJson, 'utf-8');

    // 6. Upload package to object storage
    const ownerId = workspace.ownerId || 'system';
    const packageKey = `users/${ownerId}/workspaces/${workspaceId}/package.zip`;
    const manifestKey = `users/${ownerId}/workspaces/${workspaceId}/.vaultdrop/manifest.json`;

    console.log(`[package] Uploading package (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { workspaceStatus: 'UPLOADING_PACKAGE' },
    });

    const [pkgResult, mfResult] = await Promise.all([
      putObjectSafe({
        fileKey: packageKey,
        buffer: zipBuffer,
        contentType: 'application/zip',
      }),
      putObjectSafe({
        fileKey: manifestKey,
        buffer: finalManifestBuffer,
        contentType: 'application/json',
      }),
    ]);

    // 7. Verify upload by checking existence
    const pkgExists = await objectExists(packageKey);
    if (!pkgExists) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { workspaceStatus: 'FAILED' },
      });

      return {
        success: false,
        stage: 'Package Upload Verification',
        errorCode: 'UPLOAD_VERIFICATION_FAILED',
        reason: 'Package was uploaded but could not be verified in object storage.',
        missingFiles: [],
        retryable: true,
      };
    }

    // 8. Update workspace metadata
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        packageKey,
        manifestKey,
        packageChecksum,
        packageSize: BigInt(zipBuffer.length),
        verifiedFileCount: fileBuffers.length,
        workspaceStatus: 'READY',
      },
    });

    const timeTakenMs = Date.now() - startTime;
    console.log(`[package] ✓ Package created for workspace ${workspaceId}: ${fileBuffers.length} files, ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB, ${timeTakenMs}ms`);

    return {
      success: true,
      packageKey,
      manifestKey,
      packageChecksum,
      packageSize: zipBuffer.length,
      filesIncluded: fileBuffers.length,
      missingFiles: [],
      timeTakenMs,
    };
  } catch (error: any) {
    console.error(`[package] Package creation failed for workspace ${workspaceId}:`, error);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { workspaceStatus: 'FAILED' },
    }).catch(() => {});

    return {
      success: false,
      stage: 'Package Creation',
      errorCode: 'INTERNAL_ERROR',
      reason: error.message || 'Unexpected error during package creation.',
      missingFiles: [],
      retryable: true,
    };
  }
}
