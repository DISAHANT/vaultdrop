/**
 * Workspace Manifest Engine
 * 
 * Creates deterministic manifests for workspace integrity verification.
 * Manifest is stored alongside the workspace package and can be used
 * to validate downloaded/extracted workspaces.
 */

export interface ManifestFileEntry {
  path: string;           // Relative path within workspace (no root folder prefix)
  size: number;           // File size in bytes
  sha256: string;         // SHA-256 checksum of file content
  mimeType: string;
  category: string;
  isSensitive: boolean;
  included: boolean;      // Whether included in the package
  exclusionReason?: string;
}

export interface WorkspaceManifest {
  version: 1;
  workspaceId: string;
  name: string;
  createdAt: string;
  totalFiles: number;
  includedFiles: number;
  excludedFiles: number;
  totalSizeBytes: number;
  includedSizeBytes: number;
  packageChecksum?: string;  // SHA-256 of the ZIP package itself
  files: ManifestFileEntry[];
}

/**
 * Strip the root folder prefix from a webkitRelativePath.
 * 
 * Example: "my-project/src/app.tsx" → "src/app.tsx"
 * 
 * If the path has no folder prefix (just a filename), return as-is.
 * If the path is already relative (no root folder), return as-is.
 */
export function stripRootFolder(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  
  if (parts.length <= 1) {
    // Just a filename, no folder prefix to strip
    return parts[0] || rawPath;
  }
  
  // Remove the first segment (root folder name)
  return parts.slice(1).join('/');
}

/**
 * Detect the common root folder from an array of file paths.
 * Returns the root folder name, or null if paths are heterogeneous.
 */
export function detectRootFolder(paths: string[]): string | null {
  if (paths.length === 0) return null;
  
  const normalized = paths.map(p => p.replace(/\\/g, '/'));
  const firstSegments = normalized.map(p => {
    const parts = p.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : null;
  });
  
  // ALL files must have a folder prefix for root detection to work.
  // If any file is at the top level (no folder prefix), there's no common root.
  if (firstSegments.some(s => s === null)) {
    return null;
  }
  
  const uniqueRoots = new Set(firstSegments);
  
  // If all files share the same single root folder, that's the workspace root
  if (uniqueRoots.size === 1) {
    return Array.from(uniqueRoots)[0]!;
  }
  
  return null;
}

/**
 * Build a workspace manifest from file metadata.
 * This is called server-side after all files are verified.
 */
export function buildManifest(params: {
  workspaceId: string;
  name: string;
  files: Array<{
    relativePath: string;
    fileSize: number;
    checksum: string;
    mimeType: string;
    category: string;
    isSensitive: boolean;
    included: boolean;
    exclusionReason?: string;
  }>;
  packageChecksum?: string;
}): WorkspaceManifest {
  const includedFiles = params.files.filter(f => f.included);
  const excludedFiles = params.files.filter(f => !f.included);

  return {
    version: 1,
    workspaceId: params.workspaceId,
    name: params.name,
    createdAt: new Date().toISOString(),
    totalFiles: params.files.length,
    includedFiles: includedFiles.length,
    excludedFiles: excludedFiles.length,
    totalSizeBytes: params.files.reduce((sum, f) => sum + f.fileSize, 0),
    includedSizeBytes: includedFiles.reduce((sum, f) => sum + f.fileSize, 0),
    packageChecksum: params.packageChecksum,
    files: params.files.map(f => ({
      path: f.relativePath,
      size: f.fileSize,
      sha256: f.checksum,
      mimeType: f.mimeType,
      category: f.category,
      isSensitive: f.isSensitive,
      included: f.included,
      exclusionReason: f.exclusionReason,
    })),
  };
}

/**
 * Validate an extracted workspace against a manifest.
 * Returns a validation report.
 */
export interface ManifestValidationResult {
  valid: boolean;
  expectedFiles: number;
  foundFiles: number;
  missingFiles: string[];
  extraFiles: string[];
  sizeMismatches: Array<{ path: string; expected: number; actual: number }>;
  checksumMismatches: Array<{ path: string; expected: string; actual: string }>;
}

export function validateManifest(
  manifest: WorkspaceManifest,
  actualFiles: Map<string, { size: number; sha256: string }>
): ManifestValidationResult {
  const includedManifestFiles = manifest.files.filter(f => f.included);
  const missingFiles: string[] = [];
  const sizeMismatches: Array<{ path: string; expected: number; actual: number }> = [];
  const checksumMismatches: Array<{ path: string; expected: string; actual: string }> = [];

  for (const mf of includedManifestFiles) {
    const actual = actualFiles.get(mf.path);
    if (!actual) {
      missingFiles.push(mf.path);
      continue;
    }
    if (actual.size !== mf.size) {
      sizeMismatches.push({ path: mf.path, expected: mf.size, actual: actual.size });
    }
    if (actual.sha256 !== mf.sha256) {
      checksumMismatches.push({ path: mf.path, expected: mf.sha256, actual: actual.sha256 });
    }
  }

  const manifestPaths = new Set(includedManifestFiles.map(f => f.path));
  const extraFiles = Array.from(actualFiles.keys()).filter(
    p => !p.startsWith('.vaultdrop/') && !manifestPaths.has(p)
  );

  return {
    valid: missingFiles.length === 0 && sizeMismatches.length === 0 && checksumMismatches.length === 0,
    expectedFiles: includedManifestFiles.length,
    foundFiles: actualFiles.size,
    missingFiles,
    extraFiles,
    sizeMismatches,
    checksumMismatches,
  };
}
