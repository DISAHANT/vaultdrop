import { getInstallationAccessToken } from './app';
import { parseGitHubError, GitHubApiError } from './errors';
import { getObjectBufferSafe } from '@/lib/storage/object-storage';
import { isBinaryFile, scanContentForSecrets } from './ignore';

export interface CommitFileItem {
  id?: string;
  relativePath: string;
  fileKey?: string | null;
  mimeType?: string;
  fileSize: number | bigint;
}

export interface CommitOptions {
  installationId: number;
  owner: string;
  repo: string;
  branch: string;
  commitMessage: string;
  files: CommitFileItem[];
  allowSecretsOverride?: boolean;
}

export interface CommitResult {
  success: boolean;
  commitSha: string;
  commitUrl: string;
  branch: string;
  filesCommitted: number;
  timeTakenMs: number;
  stats: {
    addedOrModified: number;
    baseCommitSha?: string;
  };
}

/**
 * Executes a Git Data API commit operation server-side for the specified workspace files
 */
export async function executeGitHubCommit(options: CommitOptions): Promise<CommitResult> {
  const startTime = Date.now();
  const {
    installationId,
    owner,
    repo,
    branch,
    commitMessage,
    files,
    allowSecretsOverride = false,
  } = options;

  if (!files || files.length === 0) {
    throw new GitHubApiError({
      step: 'Commit Validation',
      statusCode: 400,
      errorCode: 'NO_FILES_TO_COMMIT',
      reason: 'No files were provided for commit after applying ignore rules.',
      suggestedFix: 'Review workspace file selection and ensure not all files are excluded.',
      retryable: false,
    });
  }

  const token = await getInstallationAccessToken(installationId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'VaultDrop-Sync-App',
    'Content-Type': 'application/json',
  };

  // Step 1: Resolve current branch ref
  let baseCommitSha: string | null = null;
  let baseTreeSha: string | null = null;
  let isNewRepo = false;

  const refUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`;
  const refRes = await fetch(refUrl, { headers });

  if (refRes.status === 404 || refRes.status === 409) {
    // Branch does not exist or empty repository (GitHub returns 409: "Git Repository is empty.")
    const repoInfoRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers }
    );
    if (!repoInfoRes.ok) {
      const err = await repoInfoRes.json().catch(() => ({}));
      throw new GitHubApiError(parseGitHubError({ status: repoInfoRes.status, ...err }, 'Verifying Repository'));
    }
    isNewRepo = true;
  } else if (!refRes.ok) {
    const err = await refRes.json().catch(() => ({}));
    throw new GitHubApiError(parseGitHubError({ status: refRes.status, ...err }, 'Resolving Branch Reference'));
  } else {
    const refData = await refRes.json();
    baseCommitSha = refData.object.sha;

    // Step 2: Fetch base tree SHA from base commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${baseCommitSha}`,
      { headers }
    );
    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}));
      throw new GitHubApiError(parseGitHubError({ status: commitRes.status, ...err }, 'Fetching Base Commit Tree'));
    }
    const commitData = await commitRes.json();
    baseTreeSha = commitData.tree.sha;
  }

  // Handle empty repository initialization
  let filesToProcess = files;

  if (isNewRepo) {
    // Empty repository cannot accept Git Data API (/git/blobs) directly.
    // Initialize repository and default branch using the first file via Contents API.
    const firstFile = files[0];
    const firstNormalized = firstFile.relativePath.replace(/\\/g, '/');
    let firstBuffer: Buffer | null = null;
    if (firstFile.fileKey) {
      firstBuffer = await getObjectBufferSafe(firstFile.fileKey);
    }
    if (!firstBuffer) {
      firstBuffer = Buffer.from('');
    }

    if (!allowSecretsOverride) {
      const secretFinding = scanContentForSecrets(firstBuffer, firstNormalized);
      if (secretFinding) {
        throw new GitHubApiError({
          step: 'Security Check',
          statusCode: 422,
          errorCode: 'SECRET_DETECTED',
          reason: `Potential credential or secret detected in "${firstNormalized}": ${secretFinding.rule}.`,
          suggestedFix: 'Remove the secret from the file or exclude it from commit before proceeding.',
          retryable: false,
        });
      }
    }

    const initUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(firstNormalized).replace(/%2F/g, '/')}`;
    const initRes = await fetch(initUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: commitMessage.trim() || 'Initial commit via VaultDrop',
        content: firstBuffer.toString('base64'),
        branch,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new GitHubApiError(parseGitHubError({ status: initRes.status, ...err }, 'Initializing Empty Repository'));
    }

    const initData = await initRes.json();
    baseCommitSha = initData.commit.sha;
    baseTreeSha = initData.commit.tree.sha;

    if (files.length === 1) {
      const timeTakenMs = Date.now() - startTime;
      return {
        success: true,
        commitSha: baseCommitSha || '',
        commitUrl: `https://github.com/${owner}/${repo}/commit/${baseCommitSha}`,
        branch,
        filesCommitted: 1,
        timeTakenMs,
        stats: {
          addedOrModified: 1,
        },
      };
    }

    filesToProcess = files.slice(1);
  }

  // Step 3: Create Git Blobs for remaining files
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

  for (const file of filesToProcess) {
    const normalized = file.relativePath.replace(/\\/g, '/');
    let buffer: Buffer | null = null;

    if (file.fileKey) {
      buffer = await getObjectBufferSafe(file.fileKey);
    }

    if (!buffer) {
      // Empty or unreadable file fallback
      buffer = Buffer.from('');
    }

    // Security check on file contents
    if (!allowSecretsOverride) {
      const secretFinding = scanContentForSecrets(buffer, normalized);
      if (secretFinding) {
        throw new GitHubApiError({
          step: 'Security Check',
          statusCode: 422,
          errorCode: 'SECRET_DETECTED',
          reason: `Potential credential or secret detected in "${normalized}": ${secretFinding.rule}.`,
          suggestedFix: 'Remove the secret from the file or exclude it from commit before proceeding.',
          retryable: false,
        });
      }
    }

    const isBinary = isBinaryFile(normalized, file.mimeType);
    const content = isBinary ? buffer.toString('base64') : buffer.toString('utf-8');
    const encoding = isBinary ? 'base64' : 'utf-8';

    // Create Git Blob
    const blobRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, encoding }),
      }
    );

    if (!blobRes.ok) {
      const err = await blobRes.json().catch(() => ({}));
      throw new GitHubApiError(
        parseGitHubError({ status: blobRes.status, ...err }, `Uploading Git Blob for "${normalized}"`)
      );
    }

    const blobData = await blobRes.json();
    treeItems.push({
      path: normalized,
      mode: '100644', // standard file
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // Step 4: Create Git Tree
  const treePayload: any = { tree: treeItems };
  if (baseTreeSha) {
    treePayload.base_tree = baseTreeSha;
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(treePayload),
    }
  );

  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    throw new GitHubApiError(parseGitHubError({ status: treeRes.status, ...err }, 'Creating Git Tree'));
  }

  const treeData = await treeRes.json();
  const newTreeSha = treeData.sha;

  // Step 5: Create Git Commit
  const commitPayload: any = {
    message: commitMessage.trim() || 'Update workspace files via VaultDrop',
    tree: newTreeSha,
    parents: baseCommitSha ? [baseCommitSha] : [],
  };

  const newCommitRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload),
    }
  );

  if (!newCommitRes.ok) {
    const err = await newCommitRes.json().catch(() => ({}));
    throw new GitHubApiError(parseGitHubError({ status: newCommitRes.status, ...err }, 'Creating Commit'));
  }

  const newCommitData = await newCommitRes.json();
  const newCommitSha = newCommitData.sha;

  // Step 6: Update branch reference
  const updateRefRes = await fetch(refUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitSha,
      force: false,
    }),
  });

  if (!updateRefRes.ok) {
    const err = await updateRefRes.json().catch(() => ({}));
    throw new GitHubApiError(parseGitHubError({ status: updateRefRes.status, ...err }, 'Updating Branch Head'));
  }

  const timeTakenMs = Date.now() - startTime;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommitSha}`;

  return {
    success: true,
    commitSha: newCommitSha,
    commitUrl,
    branch,
    filesCommitted: files.length,
    timeTakenMs,
    stats: {
      addedOrModified: files.length,
      baseCommitSha: baseCommitSha || undefined,
    },
  };
}
