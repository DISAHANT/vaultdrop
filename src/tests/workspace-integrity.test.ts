/**
 * VaultDrop Workspace Transfer Integrity Test
 * 
 * This test creates a realistic workspace, processes it through
 * the full pipeline (scan → filter → manifest → path-stripping),
 * and verifies data integrity at every stage.
 * 
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' src/tests/workspace-integrity.test.ts
 * Or:  npx tsx src/tests/workspace-integrity.test.ts
 */

import { stripRootFolder, detectRootFolder, buildManifest, validateManifest } from '../lib/workspace/manifest';
import { sha256 } from '../lib/workspace/package';
import { createHash } from 'crypto';

// ANSI colors for test output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`${GREEN}  ✓${RESET} ${testName}`);
    passCount++;
  } else {
    console.log(`${RED}  ✕${RESET} ${testName}`);
    failCount++;
  }
}

function section(name: string) {
  console.log(`\n${BOLD}${CYAN}── ${name} ──${RESET}`);
}

// ─────────────────────────────────────────────────────────
// Test Suite 1: Root Folder Stripping
// ─────────────────────────────────────────────────────────
section('Root Folder Stripping');

assert(stripRootFolder('my-project/src/app/page.tsx') === 'src/app/page.tsx', 'Strips single root folder');
assert(stripRootFolder('my-project/package.json') === 'package.json', 'Strips root from top-level file');
assert(stripRootFolder('README.md') === 'README.md', 'Keeps simple filename');
assert(stripRootFolder('my-project/src/components/Navbar.tsx') === 'src/components/Navbar.tsx', 'Deep nesting');
assert(stripRootFolder('my-project/.env.example') === '.env.example', 'Dotfile at root');
assert(stripRootFolder('my-project/nested/one/two/test.txt') === 'nested/one/two/test.txt', 'Deep nested path');
assert(stripRootFolder('project/public/logo.png') === 'public/logo.png', 'Binary file path');
assert(stripRootFolder('my-project\\src\\app.tsx') === 'src/app.tsx', 'Backslash path normalization');

// ─────────────────────────────────────────────────────────
// Test Suite 2: Root Folder Detection
// ─────────────────────────────────────────────────────────
section('Root Folder Detection');

assert(
  detectRootFolder([
    'my-project/src/app.tsx',
    'my-project/package.json',
    'my-project/README.md',
  ]) === 'my-project',
  'Detects common root folder'
);

assert(
  detectRootFolder([
    'src/app.tsx',
    'package.json',
    'README.md',
  ]) === null,
  'No root folder when files are at root'
);

assert(
  detectRootFolder([
    'project-a/src/app.tsx',
    'project-b/src/app.tsx',
  ]) === null,
  'No root folder with multiple roots'
);

assert(detectRootFolder([]) === null, 'No root folder for empty array');

// ─────────────────────────────────────────────────────────
// Test Suite 3: Manifest Building
// ─────────────────────────────────────────────────────────
section('Manifest Building');

const testFiles = [
  { relativePath: 'src/app/page.tsx', fileSize: 4210, checksum: 'abc123', mimeType: 'text/typescript', category: 'code', isSensitive: false, included: true },
  { relativePath: 'src/components/Navbar.tsx', fileSize: 2310, checksum: 'def456', mimeType: 'text/typescript', category: 'code', isSensitive: false, included: true },
  { relativePath: '.env', fileSize: 150, checksum: 'ghi789', mimeType: 'text/plain', category: 'config', isSensitive: true, included: true },
  { relativePath: 'package.json', fileSize: 890, checksum: 'jkl012', mimeType: 'application/json', category: 'config', isSensitive: false, included: true },
  { relativePath: 'node_modules/lodash/index.js', fileSize: 50000, checksum: 'mno345', mimeType: 'text/javascript', category: 'dependency', isSensitive: false, included: false, exclusionReason: 'Dependencies' },
];

const manifest = buildManifest({
  workspaceId: 'test-ws-001',
  name: 'test-project',
  files: testFiles,
});

assert(manifest.version === 1, 'Manifest version is 1');
assert(manifest.workspaceId === 'test-ws-001', 'Manifest has correct workspace ID');
assert(manifest.totalFiles === 5, 'Manifest has correct total files');
assert(manifest.includedFiles === 4, 'Manifest has correct included count');
assert(manifest.excludedFiles === 1, 'Manifest has correct excluded count');
assert(manifest.includedSizeBytes === 4210 + 2310 + 150 + 890, 'Manifest has correct included size');
assert(manifest.files.length === 5, 'Manifest has all file entries');
assert(manifest.files.find(f => f.path === '.env')?.isSensitive === true, 'Sensitive file marked correctly');
assert(manifest.files.find(f => !f.included)?.exclusionReason === 'Dependencies', 'Exclusion reason preserved');

// ─────────────────────────────────────────────────────────
// Test Suite 4: Manifest Validation
// ─────────────────────────────────────────────────────────
section('Manifest Validation');

// Simulate a perfect extraction
const perfectExtraction = new Map<string, { size: number; sha256: string }>();
for (const f of testFiles.filter(f => f.included)) {
  perfectExtraction.set(f.relativePath, { size: f.fileSize, sha256: f.checksum });
}

const perfectResult = validateManifest(manifest, perfectExtraction);
assert(perfectResult.valid === true, 'Perfect extraction validates');
assert(perfectResult.missingFiles.length === 0, 'No missing files in perfect extraction');
assert(perfectResult.sizeMismatches.length === 0, 'No size mismatches in perfect extraction');

// Simulate missing file
const missingExtraction = new Map(perfectExtraction);
missingExtraction.delete('src/components/Navbar.tsx');

const missingResult = validateManifest(manifest, missingExtraction);
assert(missingResult.valid === false, 'Missing file causes validation failure');
assert(missingResult.missingFiles.length === 1, 'Reports 1 missing file');
assert(missingResult.missingFiles[0] === 'src/components/Navbar.tsx', 'Reports correct missing file path');

// Simulate size mismatch
const sizeExtraction = new Map(perfectExtraction);
sizeExtraction.set('package.json', { size: 999, sha256: 'jkl012' });

const sizeResult = validateManifest(manifest, sizeExtraction);
assert(sizeResult.valid === false, 'Size mismatch causes validation failure');
assert(sizeResult.sizeMismatches.length === 1, 'Reports 1 size mismatch');

// Simulate checksum mismatch
const checksumExtraction = new Map(perfectExtraction);
checksumExtraction.set('.env', { size: 150, sha256: 'WRONG_HASH' });

const checksumResult = validateManifest(manifest, checksumExtraction);
assert(checksumResult.valid === false, 'Checksum mismatch causes validation failure');
assert(checksumResult.checksumMismatches.length === 1, 'Reports 1 checksum mismatch');

// ─────────────────────────────────────────────────────────
// Test Suite 5: SHA-256 Checksum
// ─────────────────────────────────────────────────────────
section('SHA-256 Checksum');

const testBuffer = Buffer.from('Hello, VaultDrop!');
const expectedHash = createHash('sha256').update(testBuffer).digest('hex');
const actualHash = sha256(testBuffer);
assert(actualHash === expectedHash, 'SHA-256 matches crypto.createHash');
assert(actualHash.length === 64, 'SHA-256 is 64 hex chars');

const emptyHash = sha256(Buffer.from(''));
assert(emptyHash.length === 64, 'Empty buffer produces valid hash');

// ─────────────────────────────────────────────────────────
// Test Suite 6: Duplicate Filenames in Different Directories
// ─────────────────────────────────────────────────────────
section('Duplicate Filenames in Different Directories');

const dupeFiles = [
  { relativePath: 'src/a/test.js', fileSize: 100, checksum: 'aaa', mimeType: 'text/javascript', category: 'code', isSensitive: false, included: true },
  { relativePath: 'src/b/test.js', fileSize: 200, checksum: 'bbb', mimeType: 'text/javascript', category: 'code', isSensitive: false, included: true },
  { relativePath: 'src/c/deep/test.js', fileSize: 300, checksum: 'ccc', mimeType: 'text/javascript', category: 'code', isSensitive: false, included: true },
];

const dupeManifest = buildManifest({
  workspaceId: 'dupe-test',
  name: 'dupe-project',
  files: dupeFiles,
});

assert(dupeManifest.includedFiles === 3, 'All 3 duplicate-named files included');
assert(new Set(dupeManifest.files.map(f => f.path)).size === 3, 'All 3 paths are unique');

// ─────────────────────────────────────────────────────────
// Test Suite 7: Special Characters & Unicode
// ─────────────────────────────────────────────────────────
section('Special Characters & Unicode');

const specialFiles = [
  { relativePath: 'docs/hello world.txt', fileSize: 50, checksum: 'sp1', mimeType: 'text/plain', category: 'doc', isSensitive: false, included: true },
  { relativePath: 'docs/日本語ファイル.txt', fileSize: 60, checksum: 'sp2', mimeType: 'text/plain', category: 'doc', isSensitive: false, included: true },
  { relativePath: 'assets/logo (1).png', fileSize: 5000, checksum: 'sp3', mimeType: 'image/png', category: 'asset', isSensitive: false, included: true },
  { relativePath: 'config/.env.example', fileSize: 80, checksum: 'sp4', mimeType: 'text/plain', category: 'config', isSensitive: false, included: true },
  { relativePath: 'Makefile', fileSize: 200, checksum: 'sp5', mimeType: 'application/octet-stream', category: 'config', isSensitive: false, included: true },
];

const specialManifest = buildManifest({
  workspaceId: 'special-test',
  name: 'special-project',
  files: specialFiles,
});

assert(specialManifest.includedFiles === 5, 'All special-char files included');
assert(specialManifest.files.some(f => f.path.includes(' ')), 'Space in filename preserved');
assert(specialManifest.files.some(f => f.path.includes('日本語')), 'Unicode filename preserved');
assert(specialManifest.files.some(f => f.path.includes('(')), 'Parentheses in filename preserved');
assert(specialManifest.files.some(f => f.path === 'Makefile'), 'File without extension preserved');

// ─────────────────────────────────────────────────────────
// Test Suite 8: Sensitive File Handling
// ─────────────────────────────────────────────────────────
section('Sensitive File Handling');

const sensitiveIncluded = buildManifest({
  workspaceId: 'sens-test',
  name: 'sens-project',
  files: [
    { relativePath: '.env', fileSize: 150, checksum: 'env1', mimeType: 'text/plain', category: 'config', isSensitive: true, included: true },
    { relativePath: '.env.local', fileSize: 80, checksum: 'env2', mimeType: 'text/plain', category: 'config', isSensitive: true, included: true },
    { relativePath: 'src/app.ts', fileSize: 1000, checksum: 'app1', mimeType: 'text/typescript', category: 'code', isSensitive: false, included: true },
  ],
});

assert(sensitiveIncluded.includedFiles === 3, 'Sensitive files are included when user chooses to');
assert(sensitiveIncluded.files.filter(f => f.isSensitive).length === 2, 'Sensitive flag preserved');

const sensitiveExcluded = buildManifest({
  workspaceId: 'sens-test-2',
  name: 'sens-project-2',
  files: [
    { relativePath: '.env', fileSize: 150, checksum: 'env1', mimeType: 'text/plain', category: 'config', isSensitive: true, included: false, exclusionReason: 'Sensitive file excluded by user' },
    { relativePath: 'src/app.ts', fileSize: 1000, checksum: 'app1', mimeType: 'text/typescript', category: 'code', isSensitive: false, included: true },
  ],
});

assert(sensitiveExcluded.includedFiles === 1, 'Excluded sensitive file not in included count');
assert(sensitiveExcluded.excludedFiles === 1, 'Excluded sensitive file counted as excluded');

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────
console.log(`\n${BOLD}══════════════════════════════════════${RESET}`);
console.log(`${BOLD}  Test Results: ${passCount + failCount} total${RESET}`);
console.log(`${GREEN}  ✓ ${passCount} passed${RESET}`);
if (failCount > 0) {
  console.log(`${RED}  ✕ ${failCount} failed${RESET}`);
}
console.log(`${BOLD}══════════════════════════════════════${RESET}\n`);

if (failCount > 0) {
  process.exit(1);
}
