import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { analyzeWorkspaceForCommit } from '@/lib/github/ignore';
import { executeGitHubCommit } from '@/lib/github/commit';
import { getObjectBufferSafe } from '@/lib/storage/object-storage';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  const ip = getClientIP(request);
  const rateCheck = checkRateLimit(ip, 'GITHUB_COMMIT');
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Commit rate limit exceeded. Please wait a minute before making another commit.',
        details: {
          step: 'Rate Limit',
          statusCode: 429,
          errorCode: 'RATE_LIMITED',
          reason: 'Too many commit requests in a short period.',
          suggestedFix: 'Wait 60 seconds before retrying.',
          retryable: true,
        },
      },
      { status: 429 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId } = params;

  // 1. Fetch workspace and verify access
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      files: true,
    },
  });

  if (!workspace || workspace.ownerId !== user.id) {
    return NextResponse.json(
      { error: 'Workspace not found or unauthorized' },
      { status: 403 }
    );
  }

  // 2. Fetch connected repository mapping
  const repoMapping = await prisma.workspaceGitHubRepo.findFirst({
    where: {
      workspaceId,
      vaultdropUserId: user.id,
    },
  });

  if (!repoMapping) {
    return NextResponse.json(
      {
        error: 'No GitHub repository connected to this workspace.',
        details: {
          step: 'Repository Connection Check',
          statusCode: 400,
          errorCode: 'NO_REPOSITORY_CONNECTED',
          reason: 'This workspace is not linked to any GitHub repository.',
          suggestedFix: 'Connect a repository in the workspace GitHub panel first.',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  // 3. Verify GitHub connection
  const connection = await prisma.gitHubConnection.findFirst({
    where: {
      vaultdropUserId: user.id,
      status: 'active',
    },
  });

  if (!connection || !connection.githubInstallationId) {
    return NextResponse.json(
      {
        error: 'GitHub account is not connected or installation is missing.',
        details: {
          step: 'GitHub Authorization Check',
          statusCode: 401,
          errorCode: 'NOT_CONNECTED',
          reason: 'VAULTDROP SYNC app is not installed or authorization expired.',
          suggestedFix: 'Reconnect your GitHub account and install the app.',
          retryable: false,
        },
      },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const commitMessage = (body.commitMessage || '').trim() || `Update workspace ${workspace.name} via VaultDrop`;
  const branch = body.branch || repoMapping.defaultBranch || 'main';
  const allowSecretsOverride = !!body.allowSecretsOverride;
  const userOverrides: string[] = Array.isArray(body.userOverrides) ? body.userOverrides : [];

  // Check if workspace contains a .gitignore
  let gitignoreContent: string | undefined = undefined;
  const gitignoreFile = workspace.files.find(
    (f) => f.relativePath === '.gitignore' || f.filename === '.gitignore'
  );
  if (gitignoreFile && gitignoreFile.fileKey) {
    try {
      const buf = await getObjectBufferSafe(gitignoreFile.fileKey);
      if (buf) gitignoreContent = buf.toString('utf-8');
    } catch {}
  }

  // 4. Run ignore & secret detection
  const analysis = analyzeWorkspaceForCommit({
    files: workspace.files.map((f) => ({
      id: f.id,
      relativePath: f.relativePath,
      filename: f.filename,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      fileKey: f.fileKey,
    })),
    gitignoreContent,
    userOverrides,
  });

  // Stop commit if secrets are detected and override is not granted
  if (analysis.hasSecrets && !allowSecretsOverride) {
    return NextResponse.json(
      {
        error: 'Potential secret detected in workspace files. Commit was stopped for security.',
        details: {
          step: 'Security Check',
          statusCode: 422,
          errorCode: 'SECRET_DETECTED',
          reason: `Found ${analysis.securityFindings.length} file(s) containing credentials or secret patterns.`,
          suggestedFix: 'Review and remove secret files from commit, or explicitly override if intentional.',
          findings: analysis.securityFindings,
          retryable: false,
        },
      },
      { status: 422 }
    );
  }

  if (analysis.includedFiles.length === 0) {
    return NextResponse.json(
      {
        error: 'No files to commit. All workspace files were excluded by ignore rules.',
        details: {
          step: 'File Analysis',
          statusCode: 400,
          errorCode: 'NO_FILES_TO_COMMIT',
          reason: 'All files in this workspace match ignore rules.',
          suggestedFix: 'Verify your workspace files and override rules where appropriate.',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  // Map included files to CommitFileItem
  const commitFiles = analysis.includedFiles.map((item) => {
    const orig = workspace.files.find((f) => f.relativePath === item.relativePath);
    return {
      id: item.id,
      relativePath: item.relativePath,
      fileKey: orig?.fileKey || null,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
    };
  });

  // 5. Execute GitHub Commit
  try {
    const result = await executeGitHubCommit({
      installationId: repoMapping.installationId,
      owner: repoMapping.owner,
      repo: repoMapping.repositoryName,
      branch,
      commitMessage,
      files: commitFiles,
      allowSecretsOverride,
    });

    // Update database repo mapping with latest commit
    await prisma.workspaceGitHubRepo.update({
      where: { id: repoMapping.id },
      data: {
        lastCommitSha: result.commitSha,
        lastSyncAt: new Date(),
        defaultBranch: branch,
      },
    });

    // Audit log successful commit
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId,
        repositoryId: repoMapping.repositoryId,
        repositoryName: `${repoMapping.owner}/${repoMapping.repositoryName}`,
        operation: 'COMMIT',
        status: 'success',
        commitSha: result.commitSha,
        filesChanged: result.filesCommitted,
        metadata: JSON.stringify({
          branch,
          commitUrl: result.commitUrl,
          timeTakenMs: result.timeTakenMs,
          ignoredCount: analysis.ignoredCount,
        }),
      },
    });

    // In-app notification on commit success
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        type: 'github_commit_success',
        title: 'GitHub commit successful',
        message: `"${workspace.name}" committed to ${repoMapping.owner}/${repoMapping.repositoryName} (${branch})`,
        workspaceId,
        metadata: JSON.stringify({
          commitSha: result.commitSha,
          commitUrl: result.commitUrl,
          branch: result.branch,
          repository: `${repoMapping.owner}/${repoMapping.repositoryName}`,
          filesCommitted: result.filesCommitted,
        }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
      branch: result.branch,
      repository: `${repoMapping.owner}/${repoMapping.repositoryName}`,
      filesCommitted: result.filesCommitted,
      ignoredCount: analysis.ignoredCount,
      timeTakenMs: result.timeTakenMs,
      stats: result.stats,
    });
  } catch (err: any) {
    console.error('Execute GitHub commit error:', err);
    const errorInfo = err?.info || {
      step: 'Creating Commit',
      statusCode: 500,
      errorCode: 'COMMIT_FAILED',
      reason: err?.message || 'Failed to complete commit to GitHub repository.',
      suggestedFix: 'Review technical details or check GitHub repository permissions.',
      retryable: true,
    };

    // In-app notification on commit failure
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        type: 'github_commit_failed',
        title: 'GitHub commit failed',
        message: `Failed to commit "${workspace.name}" to ${repoMapping.owner}/${repoMapping.repositoryName}: ${errorInfo.reason}`,
        workspaceId,
        metadata: JSON.stringify({
          errorCode: errorInfo.errorCode,
          reason: errorInfo.reason,
          suggestedFix: errorInfo.suggestedFix,
          repository: `${repoMapping.owner}/${repoMapping.repositoryName}`,
        }),
      },
    }).catch(() => null);

    // Audit log failed commit
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId,
        repositoryId: repoMapping.repositoryId,
        repositoryName: `${repoMapping.owner}/${repoMapping.repositoryName}`,
        operation: 'COMMIT',
        status: 'failed',
        errorCode: errorInfo.errorCode,
        errorMessage: errorInfo.reason,
        metadata: JSON.stringify({
          step: errorInfo.step,
          technicalDetails: errorInfo.technicalDetails,
        }),
      },
    });

    return NextResponse.json(
      {
        error: errorInfo.reason,
        details: errorInfo,
      },
      { status: errorInfo.statusCode || 500 }
    );
  }
}
