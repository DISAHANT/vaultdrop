/**
 * VaultDrop Intelligent Ignore Engine & Security Scanner
 * Pre-commit workspace analysis, category-based exclusions, .gitignore parsing, and secret detection.
 */

export type IgnoreCategory =
  | 'DEPENDENCY'
  | 'BUILD_OUTPUT'
  | 'CACHE'
  | 'ENVIRONMENT'
  | 'SECRET'
  | 'TEMPORARY'
  | 'OS_FILE'
  | 'LARGE_FILE'
  | 'GITIGNORE'
  | 'USER_EXCLUDED';

export interface AnalyzedFile {
  id?: string;
  relativePath: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  isBinary: boolean;
  isExcluded: boolean;
  category?: IgnoreCategory;
  reason?: string;
  isSensitive?: boolean;
  secretFinding?: string;
}

export interface CategorySummary {
  category: IgnoreCategory;
  name: string;
  fileCount: number;
  totalSize: number;
  reason: string;
  sampleFiles: string[];
}

export interface SecurityFinding {
  filePath: string;
  rule: string;
  reason: string;
  lineSnippet?: string; // sanitized line snippet without showing full credential
}

export interface WorkspaceAnalysisResult {
  totalFiles: number;
  totalSize: number;
  includedCount: number;
  ignoredCount: number;
  includedSize: number;
  ignoredSize: number;
  includedFiles: AnalyzedFile[];
  ignoredFiles: AnalyzedFile[];
  ignoredByCategory: Record<string, CategorySummary>;
  warnings: string[];
  securityFindings: SecurityFinding[];
  hasSecrets: boolean;
  generatedCount: number;
  dependencyCount: number;
  largeFileCount: number;
}

// Built-in safety default ignore rules
interface SafetyRule {
  pattern: string | RegExp;
  category: IgnoreCategory;
  name: string;
  reason: string;
  isFolder?: boolean;
}

export const SAFETY_IGNORE_RULES: SafetyRule[] = [
  // Dependencies
  { pattern: 'node_modules', category: 'DEPENDENCY', name: 'node_modules/', reason: 'Project dependencies directory (install locally via package manager)', isFolder: true },
  { pattern: '.pnpm-store', category: 'DEPENDENCY', name: '.pnpm-store/', reason: 'pnpm package store cache', isFolder: true },
  { pattern: 'vendor', category: 'DEPENDENCY', name: 'vendor/', reason: 'Third-party vendor dependencies', isFolder: true },

  // Build Output
  { pattern: '.next', category: 'BUILD_OUTPUT', name: '.next/', reason: 'Next.js build and cache directory', isFolder: true },
  { pattern: 'dist', category: 'BUILD_OUTPUT', name: 'dist/', reason: 'Distribution and compiled build output', isFolder: true },
  { pattern: 'build', category: 'BUILD_OUTPUT', name: 'build/', reason: 'Compiled build artifacts', isFolder: true },
  { pattern: 'out', category: 'BUILD_OUTPUT', name: 'out/', reason: 'Static export output directory', isFolder: true },
  { pattern: '.turbo', category: 'BUILD_OUTPUT', name: '.turbo/', reason: 'Turborepo cache and artifact store', isFolder: true },
  { pattern: '.vercel', category: 'BUILD_OUTPUT', name: '.vercel/', reason: 'Vercel serverless build artifacts', isFolder: true },
  { pattern: 'target', category: 'BUILD_OUTPUT', name: 'target/', reason: 'Rust / Maven compiler output', isFolder: true },
  { pattern: '.nuxt', category: 'BUILD_OUTPUT', name: '.nuxt/', reason: 'Nuxt.js build directory', isFolder: true },
  { pattern: '.svelte-kit', category: 'BUILD_OUTPUT', name: '.svelte-kit/', reason: 'SvelteKit build artifacts', isFolder: true },
  { pattern: /\.tsbuildinfo$/i, category: 'BUILD_OUTPUT', name: '*.tsbuildinfo', reason: 'TypeScript incremental build cache' },

  // Cache
  { pattern: '.cache', category: 'CACHE', name: '.cache/', reason: 'General compiler/bundler cache', isFolder: true },
  { pattern: '.vite', category: 'CACHE', name: '.vite/', reason: 'Vite build and pre-bundling cache', isFolder: true },
  { pattern: '__pycache__', category: 'CACHE', name: '__pycache__/', reason: 'Python bytecode cache', isFolder: true },
  { pattern: '.pytest_cache', category: 'CACHE', name: '.pytest_cache/', reason: 'Pytest execution cache', isFolder: true },
  { pattern: '.parcel-cache', category: 'CACHE', name: '.parcel-cache/', reason: 'Parcel bundler cache', isFolder: true },
  { pattern: 'coverage', category: 'CACHE', name: 'coverage/', reason: 'Test coverage reports', isFolder: true },

  // Environment & Secrets
  { pattern: /^\.env(\.(?!example|sample|template)[a-zA-Z0-9_\-]+)?$/i, category: 'ENVIRONMENT', name: '.env files', reason: 'Environment configuration file containing potential secrets' },
  { pattern: /\.(pem|key|pkcs8|p12|pfx|jks|keystore)$/i, category: 'SECRET', name: 'Private Key / Keystore', reason: 'Cryptographic private key or certificate' },
  { pattern: /(id_rsa|id_ed25519|id_ecdsa)$/i, category: 'SECRET', name: 'SSH Private Key', reason: 'SSH private identification key' },
  { pattern: /(credentials\.json|service-account\.json|gcloud-credentials\.json|aws_credentials|client_secret.*\.json)$/i, category: 'SECRET', name: 'Cloud Credentials', reason: 'Service account or cloud credential file' },

  // Temporary & OS
  { pattern: 'tmp', category: 'TEMPORARY', name: 'tmp/', reason: 'Temporary file directory', isFolder: true },
  { pattern: 'temp', category: 'TEMPORARY', name: 'temp/', reason: 'Temporary storage directory', isFolder: true },
  { pattern: /\.log$/i, category: 'TEMPORARY', name: '*.log', reason: 'Log file output' },
  { pattern: '.DS_Store', category: 'OS_FILE', name: '.DS_Store', reason: 'macOS Finder metadata file' },
  { pattern: 'Thumbs.db', category: 'OS_FILE', name: 'Thumbs.db', reason: 'Windows thumbnail cache database' },
  { pattern: '.vaultdrop-storage', category: 'TEMPORARY', name: '.vaultdrop-storage/', reason: 'VaultDrop local cache directory', isFolder: true },
];

// Binary file extensions
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'wasm'
]);

// Secret regex detectors for content inspection
const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', pattern: /(ghp_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{60,82})/ },
  { name: 'Generic API Key / Secret', pattern: /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i },
  { name: 'Private Key Block', pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/ },
  { name: 'Database Connection String with Password', pattern: /(postgres|mysql|mongodb\+srv):\/\/[^:\s]+:[^@\s]+@[^\s]+/i },
  { name: 'Slack Bot Token', pattern: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/ },
  { name: 'Stripe Secret Key', pattern: /sk_live_[0-9a-zA-Z]{24}/ },
];

/**
 * Checks if a file path is considered binary based on extension or mime type
 */
export function isBinaryFile(relativePath: string, mimeType?: string): boolean {
  if (mimeType) {
    if (mimeType.startsWith('image/') && !mimeType.includes('svg')) return true;
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return true;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return true;
    if (mimeType.includes('pdf') || mimeType.includes('octet-stream')) return true;
  }

  const parts = relativePath.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }
  return false;
}

/**
 * Parses simple .gitignore contents into regex patterns
 */
export function parseGitignore(content: string): RegExp[] {
  const patterns: RegExp[] = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Convert gitignore glob pattern to simple regex
    let clean = line;
    if (clean.startsWith('/')) clean = clean.slice(1);
    if (clean.endsWith('/')) clean = clean.slice(0, -1);

    const escaped = clean
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    try {
      patterns.push(new RegExp(`(^|/)${escaped}(/|$)`, 'i'));
    } catch {}
  }

  return patterns;
}

/**
 * Scans content buffer for known secret patterns.
 * Never returns the matched secret, only the rule name.
 */
export function scanContentForSecrets(buffer: Buffer, filePath: string): SecurityFinding | null {
  // Do not scan large binary files for text secrets
  if (buffer.length > 2 * 1024 * 1024) return null;

  try {
    const text = buffer.toString('utf-8');
    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(text)) {
        return {
          filePath,
          rule: rule.name,
          reason: `File content matches known pattern: ${rule.name}.`,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Executes a comprehensive analysis of workspace files prior to commit
 */
export function analyzeWorkspaceForCommit(options: {
  files: Array<{
    id?: string;
    relativePath: string;
    filename?: string;
    fileSize: number | bigint;
    mimeType?: string;
    fileKey?: string | null;
  }>;
  gitignoreContent?: string;
  userOverrides?: string[]; // files the user explicitly chose to include despite rules
}): WorkspaceAnalysisResult {
  const { files, gitignoreContent, userOverrides = [] } = options;

  const gitignorePatterns = gitignoreContent ? parseGitignore(gitignoreContent) : [];
  const overrideSet = new Set(userOverrides.map((p) => p.replace(/\\/g, '/')));

  const includedFiles: AnalyzedFile[] = [];
  const ignoredFiles: AnalyzedFile[] = [];
  const securityFindings: SecurityFinding[] = [];
  const warnings: string[] = [];

  const ignoredByCategory: Record<string, CategorySummary> = {};

  let totalSize = 0;
  let includedSize = 0;
  let ignoredSize = 0;
  let generatedCount = 0;
  let dependencyCount = 0;
  let largeFileCount = 0;

  for (const file of files) {
    const normalized = file.relativePath.replace(/\\/g, '/');
    const size = Number(file.fileSize);
    const fileName = normalized.split('/').pop() || normalized;
    const isBinary = isBinaryFile(normalized, file.mimeType);

    totalSize += size;

    // Check large files (> 50 MB)
    if (size > 50 * 1024 * 1024) {
      largeFileCount++;
      warnings.push(`File "${normalized}" exceeds 50MB (${(size / (1024 * 1024)).toFixed(1)}MB). GitHub may reject blobs exceeding 100MB.`);
    }

    // Check if explicitly overridden by user
    if (overrideSet.has(normalized)) {
      includedFiles.push({
        id: file.id,
        relativePath: normalized,
        fileName,
        fileSize: size,
        mimeType: file.mimeType,
        isBinary,
        isExcluded: false,
      });
      includedSize += size;
      continue;
    }

    let matchCategory: IgnoreCategory | null = null;
    let matchReason = '';
    let matchName = '';

    // 1. Check safety rules
    const pathParts = normalized.split('/');
    for (const rule of SAFETY_IGNORE_RULES) {
      if (typeof rule.pattern === 'string') {
        const pLower = rule.pattern.toLowerCase();
        if (rule.isFolder) {
          const hasFolder = pathParts.some((part) => part.toLowerCase() === pLower);
          if (hasFolder) {
            matchCategory = rule.category;
            matchReason = rule.reason;
            matchName = rule.name;
            break;
          }
        } else {
          if (fileName.toLowerCase() === pLower) {
            matchCategory = rule.category;
            matchReason = rule.reason;
            matchName = rule.name;
            break;
          }
        }
      } else {
        if (rule.pattern.test(fileName) || rule.pattern.test(normalized)) {
          matchCategory = rule.category;
          matchReason = rule.reason;
          matchName = rule.name;
          break;
        }
      }
    }

    // 2. Check gitignore patterns
    if (!matchCategory && gitignorePatterns.length > 0) {
      for (const pattern of gitignorePatterns) {
        if (pattern.test(normalized) || pattern.test(fileName)) {
          matchCategory = 'GITIGNORE';
          matchReason = 'Excluded by project .gitignore configuration';
          matchName = '.gitignore rule';
          break;
        }
      }
    }

    // 3. Track security findings if file path indicates sensitive credentials
    if (matchCategory === 'SECRET' || matchCategory === 'ENVIRONMENT') {
      securityFindings.push({
        filePath: normalized,
        rule: matchName,
        reason: matchReason,
      });
    }

    if (matchCategory) {
      if (matchCategory === 'DEPENDENCY') dependencyCount++;
      if (matchCategory === 'BUILD_OUTPUT') generatedCount++;

      ignoredFiles.push({
        id: file.id,
        relativePath: normalized,
        fileName,
        fileSize: size,
        mimeType: file.mimeType,
        isBinary,
        isExcluded: true,
        category: matchCategory,
        reason: matchReason,
      });
      ignoredSize += size;

      if (!ignoredByCategory[matchCategory]) {
        ignoredByCategory[matchCategory] = {
          category: matchCategory,
          name: matchName,
          fileCount: 0,
          totalSize: 0,
          reason: matchReason,
          sampleFiles: [],
        };
      }
      ignoredByCategory[matchCategory].fileCount++;
      ignoredByCategory[matchCategory].totalSize += size;
      if (ignoredByCategory[matchCategory].sampleFiles.length < 5) {
        ignoredByCategory[matchCategory].sampleFiles.push(normalized);
      }
    } else {
      includedFiles.push({
        id: file.id,
        relativePath: normalized,
        fileName,
        fileSize: size,
        mimeType: file.mimeType,
        isBinary,
        isExcluded: false,
      });
      includedSize += size;
    }
  }

  return {
    totalFiles: files.length,
    totalSize,
    includedCount: includedFiles.length,
    ignoredCount: ignoredFiles.length,
    includedSize,
    ignoredSize,
    includedFiles,
    ignoredFiles,
    ignoredByCategory,
    warnings,
    securityFindings,
    hasSecrets: securityFindings.length > 0,
    generatedCount,
    dependencyCount,
    largeFileCount,
  };
}
