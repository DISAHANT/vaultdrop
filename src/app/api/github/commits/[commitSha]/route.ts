import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { getInstallationAccessToken } from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { commitSha: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commitSha } = params;
    const url = new URL(request.url);
    let owner = url.searchParams.get('owner');
    let repo = url.searchParams.get('repo');

    // If owner/repo not provided in query, look up from recent GitHubOperation or WorkspaceGitHubRepo
    if (!owner || !repo) {
      const op = await prisma.gitHubOperation.findFirst({
        where: {
          vaultdropUserId: user.id,
          commitSha,
        },
      });

      if (op?.repositoryName && op.repositoryName.includes('/')) {
        const parts = op.repositoryName.split('/');
        owner = parts[0];
        repo = parts[1];
      }
    }

    if (!owner || !repo) {
      const mapping = await prisma.workspaceGitHubRepo.findFirst({
        where: {
          vaultdropUserId: user.id,
          lastCommitSha: commitSha,
        },
      });

      if (mapping) {
        owner = mapping.owner;
        repo = mapping.repositoryName;
      }
    }

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Repository information could not be determined for this commit.' },
        { status: 400 }
      );
    }

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
    });

    if (!connection || !connection.githubInstallationId) {
      return NextResponse.json(
        { error: 'GitHub is not connected.' },
        { status: 403 }
      );
    }

    const token = await getInstallationAccessToken(connection.githubInstallationId);
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VaultDrop-Sync-App',
    };

    // 1. Fetch check runs for this commit
    const checkRunsRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(commitSha)}/check-runs`,
      { headers }
    );

    let checkRuns: any[] = [];
    if (checkRunsRes.ok) {
      const checkData = await checkRunsRes.json();
      checkRuns = checkData.check_runs || [];
    }

    // Determine overall CI status
    let overallStatus: 'pending' | 'running' | 'success' | 'failed' | 'none' = 'none';

    if (checkRuns.length > 0) {
      const hasFailed = checkRuns.some(
        (c) => c.conclusion === 'failure' || c.conclusion === 'timed_out' || c.conclusion === 'action_required'
      );
      const isRunning = checkRuns.some(
        (c) => c.status === 'in_progress' || c.status === 'queued'
      );
      const allPassed = checkRuns.every(
        (c) => c.status === 'completed' && (c.conclusion === 'success' || c.conclusion === 'neutral' || c.conclusion === 'skipped')
      );

      if (hasFailed) overallStatus = 'failed';
      else if (isRunning) overallStatus = 'running';
      else if (allPassed) overallStatus = 'success';
      else overallStatus = 'pending';
    }

    const formattedRuns = checkRuns.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.status, // queued, in_progress, completed
      conclusion: run.conclusion, // success, failure, neutral, cancelled, timed_out, action_required
      startedAt: run.started_at,
      completedAt: run.completed_at,
      htmlUrl: run.html_url,
      output: run.output ? {
        title: run.output.title,
        summary: run.output.summary,
      } : null,
    }));

    return NextResponse.json({
      commitSha,
      repository: `${owner}/${repo}`,
      overallStatus,
      totalChecks: checkRuns.length,
      checkRuns: formattedRuns,
    });
  } catch (error: any) {
    console.error('Fetch commit check runs error:', error);
    return NextResponse.json({ error: 'Failed to fetch commit checks' }, { status: 500 });
  }
}
