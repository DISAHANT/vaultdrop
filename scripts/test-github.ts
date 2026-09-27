/**
 * Automated Test Suite for VaultDrop GitHub Integration
 * Validates:
 * 1. App JWT generation & RS256 signing
 * 2. Ignore engine categorization (.next, node_modules, build, etc.)
 * 3. Secret scanner detection
 * 4. Structured error diagnostics
 * 5. Webhook HMAC-SHA256 signature verification
 * 6. Binary file detection
 */

import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateAppJwt, getGitHubPrivateKey, getGitHubAppConfig } from '../src/lib/github/app';
import { analyzeWorkspaceForCommit, scanContentForSecrets, isBinaryFile } from '../src/lib/github/ignore';
import { parseGitHubError } from '../src/lib/github/errors';
import { verifyWebhookSignature } from '../src/lib/github/webhook';

console.log('--- Running VaultDrop GitHub Integration Test Suite ---');

async function runTests() {
  // Test 1: GitHub Private Key & App JWT Generation
  console.log('[Test 1] Testing GitHub App JWT Generation & RS256 Signature...');
  const key = getGitHubPrivateKey();
  assert(key.includes('BEGIN RSA PRIVATE KEY'), 'Private key should be valid PEM RSA');

  const appJwt = generateAppJwt();
  assert(typeof appJwt === 'string' && appJwt.length > 50, 'JWT should be a valid non-empty string');

  const decoded: any = jwt.decode(appJwt, { complete: true });
  assert.strictEqual(decoded.header.alg, 'RS256', 'JWT algorithm should be RS256');
  assert.strictEqual(decoded.payload.iss, '5099865', 'Issuer should match GITHUB_APP_ID');
  console.log('✓ Test 1 Passed: RS256 App JWT generated successfully with valid claims.');

  // Test 2: Ignore Engine & File Categorization
  console.log('[Test 2] Testing Workspace Ignore Engine...');
  const mockFiles = [
    { relativePath: 'src/index.ts', fileSize: 1024, mimeType: 'text/typescript' },
    { relativePath: 'package.json', fileSize: 512, mimeType: 'application/json' },
    { relativePath: 'node_modules/react/index.js', fileSize: 4096 },
    { relativePath: '.next/static/chunks/main.js', fileSize: 8192 },
    { relativePath: 'dist/bundle.js', fileSize: 16384 },
    { relativePath: '.env.local', fileSize: 256 },
    { relativePath: 'private-key.pem', fileSize: 1600 },
    { relativePath: 'public/hero.png', fileSize: 1048576, mimeType: 'image/png' },
    { relativePath: '.turbo/cache.json', fileSize: 2048 },
    { relativePath: 'coverage/lcov.info', fileSize: 4096 },
    { relativePath: '.DS_Store', fileSize: 120 },
  ];

  const analysis = analyzeWorkspaceForCommit({ files: mockFiles });

  assert.strictEqual(analysis.totalFiles, 11, 'Total files should be 11');
  assert.strictEqual(analysis.includedCount, 3, 'Included files should be 3 (src/index.ts, package.json, public/hero.png)');
  assert.strictEqual(analysis.ignoredCount, 8, 'Ignored files should be 8');
  assert(analysis.ignoredByCategory['DEPENDENCY'], 'Should have DEPENDENCY category for node_modules');
  assert(analysis.ignoredByCategory['BUILD_OUTPUT'], 'Should have BUILD_OUTPUT category for .next and dist');
  assert(analysis.ignoredByCategory['ENVIRONMENT'], 'Should have ENVIRONMENT category for .env.local');
  assert(analysis.ignoredByCategory['SECRET'], 'Should have SECRET category for .pem');
  assert(analysis.hasSecrets, 'Should detect potential secrets from .env.local and .pem');
  console.log('✓ Test 2 Passed: Ignore engine successfully categorized dependencies, build outputs, and config files.');

  // Test 3: Secret Detection Scanner
  console.log('[Test 3] Testing Content Secret Detection Scanner...');
  const safeBuffer = Buffer.from('const app = express(); app.listen(3000);');
  const safeFinding = scanContentForSecrets(safeBuffer, 'src/server.ts');
  assert.strictEqual(safeFinding, null, 'Safe code should not trigger secret alert');

  const awsSecretBuffer = Buffer.from('export const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";');
  const awsFinding = scanContentForSecrets(awsSecretBuffer, 'config/aws.ts');
  assert(awsFinding !== null, 'AWS key pattern should be detected');
  assert.strictEqual(awsFinding?.rule, 'AWS Access Key');

  const githubTokenBuffer = Buffer.from('const token = "ghp_123456789012345678901234567890123456";');
  const ghFinding = scanContentForSecrets(githubTokenBuffer, 'scripts/sync.ts');
  assert(ghFinding !== null, 'GitHub PAT should be detected');
  assert.strictEqual(ghFinding?.rule, 'GitHub Token');

  const dbSecretBuffer = Buffer.from('const uri = "postgres://admin:SuperSecretPassword123@db.prod.internal:5432/main";');
  const dbFinding = scanContentForSecrets(dbSecretBuffer, 'src/db.ts');
  assert(dbFinding !== null, 'Database URI with credentials should be detected');
  console.log('✓ Test 3 Passed: Secret scanner successfully detected credentials without false positives on clean code.');

  // Test 4: Structured Error Diagnostics
  console.log('[Test 4] Testing Structured Error Diagnostics...');
  const err401 = parseGitHubError({ status: 401, message: 'Bad credentials' }, 'OAuth');
  assert.strictEqual(err401.statusCode, 401);
  assert.strictEqual(err401.errorCode, 'UNAUTHORIZED');
  assert(err401.suggestedFix.includes('reconnect'), 'Should suggest reconnecting account');

  const err403 = parseGitHubError({ status: 403, message: 'Resource not accessible by integration' }, 'Commit');
  assert.strictEqual(err403.statusCode, 403);
  assert.strictEqual(err403.errorCode, 'FORBIDDEN');
  assert(err403.reason.includes('write access'), 'Should explain missing write permission');

  const err409 = parseGitHubError({ status: 409, message: 'Reference update conflict' }, 'Push');
  assert.strictEqual(err409.statusCode, 409);
  assert.strictEqual(err409.errorCode, 'CONFLICT');

  const err429 = parseGitHubError({ status: 429, message: 'Too many requests' }, 'Sync');
  assert.strictEqual(err429.statusCode, 429);
  assert.strictEqual(err429.retryable, true);
  console.log('✓ Test 4 Passed: Structured errors mapped cleanly with user fixes.');

  // Test 5: Webhook Signature Verification
  console.log('[Test 5] Testing Webhook HMAC SHA-256 Signature Verification...');
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';
  const testPayload = JSON.stringify({ action: 'created', installation: { id: 12345 } });

  const hmac = crypto.createHmac('sha256', webhookSecret);
  const validSignature = `sha256=${hmac.update(testPayload).digest('hex')}`;

  assert.strictEqual(verifyWebhookSignature(testPayload, validSignature), true, 'Valid signature should verify');
  assert.strictEqual(verifyWebhookSignature(testPayload, 'sha256=invalidhash123'), false, 'Invalid signature should fail');
  assert.strictEqual(verifyWebhookSignature(testPayload, null), false, 'Missing signature should fail');
  console.log('✓ Test 5 Passed: Webhook signature verification verified with HMAC-SHA256.');

  // Test 6: Binary File Detection
  console.log('[Test 6] Testing Binary File Detection...');
  assert.strictEqual(isBinaryFile('image.png', 'image/png'), true);
  assert.strictEqual(isBinaryFile('clip.mp4', 'video/mp4'), true);
  assert.strictEqual(isBinaryFile('archive.zip', 'application/zip'), true);
  assert.strictEqual(isBinaryFile('document.pdf', 'application/pdf'), true);
  assert.strictEqual(isBinaryFile('index.ts', 'text/plain'), false);
  assert.strictEqual(isBinaryFile('style.css', 'text/css'), false);
  console.log('✓ Test 6 Passed: Binary file detection accurate.');

  console.log('\n======================================================');
  console.log('ALL 6 TEST SUITES PASSED CLEANLY (100% SUCCESS)');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
