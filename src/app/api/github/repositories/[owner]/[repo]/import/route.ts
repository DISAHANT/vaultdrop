import { NextResponse } from 'next/server';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import prisma from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSessionUser } from '@/lib/auth';
import { getInstallationAccessToken } from '@/lib/github/app';
import { putObject, isFilebaseConfigured } from '@/lib/storage/object-storage';
import { isExcluded } from '@/lib/workspace/exclusions';

export const dynamic = 'force-dynamic';
// Allow sufficient runtime for downloading and extracting larger repositories
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { owner, repo } = params;

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub is not connected.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const branch = (body.branch || 'main').trim();
    const workspaceName = (body.workspaceName || repo).trim();

    // 1. Obtain token: installation token or user access token
    let token: string | null = null;
    if (connection.githubInstallationId) {
      try {
        token = await getInstallationAccessToken(connection.githubInstallationId);
      } catch (err) {
        console.warn('Could not get installation token, trying accessToken:', err);
      }
    }
    if (!token && connection.accessToken) {
      token = connection.accessToken;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No valid GitHub token available to download repository.' },
        { status: 401 }
      );
    }

    // 2. Download repository zipball from GitHub API
    const zipUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(branch)}`;
    const zipRes = await fetch(zipUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'VaultDrop-Sync-App',
      },
      redirect: 'follow',
    });

    if (!zipRes.ok) {
      const errText = await zipRes.text().catch(() => '');
      return NextResponse.json(
        {
          error: `GitHub failed to package repository: ${zipRes.status} ${zipRes.statusText}`,
          details: {
            statusCode: zipRes.status,
            reason: errText || 'Could not fetch repository zipball for branch.',
            suggestedFix: 'Verify the branch name exists and you have read access.',
          },
        },
        { status: zipRes.status }
      );
    }

    const arrayBuffer = await zipRes.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // 3. Extract in-memory using AdmZip
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    if (zipEntries.length === 0) {
      return NextResponse.json(
        { error: 'Repository archive is empty.' },
        { status: 400 }
      );
    }

    // Determine the root prefix (GitHub zipballs prefix all entries with "{owner}-{repo}-{commitSha}/")
    const firstEntry = zipEntries[0];
    const rootPrefix = firstEntry.entryName.split('/')[0] + '/';

    // 4. Create Workspace record first
    const uploadSessionId = `import_${owner}_${repo}_${Date.now()}`;
    const workspace = await prisma.workspace.create({
      data: {
        name: workspaceName,
        ownerId: user.id,
        uploadSessionId,
        shareCode: nanoid(10).toUpperCase(),
        totalFiles: 0,
        totalSize: BigInt(0),
        verifiedFileCount: 0,
        workspaceStatus: 'PACKAGING',
      },
    });

    const fileRecords: Array<{
      workspaceId: string;
      relativePath: string;
      filename: string;
      fileSize: bigint;
      mimeType: string;
      fileKey: string;
      checksum: string;
      category: string;
      isSensitive: boolean;
      uploadVerified: boolean;
    }> = [];

    let totalBytesSum = BigInt(0);

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      let cleanPath = entry.entryName;
      if (cleanPath.startsWith(rootPrefix)) {
        cleanPath = cleanPath.slice(rootPrefix.length);
      }

      if (!cleanPath || cleanPath.startsWith('.git/')) continue;

      // Check exclusions (e.g. skip huge node_modules if present in repo)
      if (isExcluded(cleanPath)) continue;

      const fileData = entry.getData();
      const fileSize = BigInt(fileData.length);
      totalBytesSum += fileSize;

      const filename = cleanPath.split('/').pop() || cleanPath;
      const sha256Checksum = crypto.createHash('sha256').update(fileData).digest('hex');

      // Simple MIME type inference
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'text/plain';
      if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) mimeType = 'text/javascript';
      else if (['json'].includes(ext)) mimeType = 'application/json';
      else if (['html'].includes(ext)) mimeType = 'text/html';
      else if (['css'].includes(ext)) mimeType = 'text/css';
      else if (['png'].includes(ext)) mimeType = 'image/png';
      else if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (['svg'].includes(ext)) mimeType = 'image/svg+xml';
      else if (['pdf'].includes(ext)) mimeType = 'application/pdf';

      const fileKey = `workspaces/${workspace.id}/${cleanPath.replace(/\\/g, '/')}`;

      // Upload to Filebase/storage
      try {
        await putObject(fileKey, fileData, mimeType);
      } catch (uploadErr) {
        console.warn(`Failed to upload ${cleanPath} to object storage:`, uploadErr);
      }

      const isSensitive =
        cleanPath.includes('.env') ||
        cleanPath.endsWith('.pem') ||
        cleanPath.endsWith('.key') ||
        cleanPath.includes('credentials');

      fileRecords.push({
        workspaceId: workspace.id,
        relativePath: cleanPath,
        filename,
        fileSize,
        mimeType,
        fileKey,
        checksum: sha256Checksum,
        category: 'code',
        isSensitive,
        uploadVerified: true,
      });
    }

    // 5. Batch insert files in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < fileRecords.length; i += chunkSize) {
      const chunk = fileRecords.slice(i, i + chunkSize);
      await prisma.workspaceFile.createMany({
        data: chunk,
      });
    }

    // 6. Update workspace to READY
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        totalFiles: fileRecords.length,
        totalSize: totalBytesSum,
        verifiedFileCount: fileRecords.length,
        workspaceStatus: 'READY',
      },
    });

    // 7. Auto-connect workspace to repository
    if (connection.githubInstallationId) {
      await prisma.workspaceGitHubRepo.create({
        data: {
          workspaceId: workspace.id,
          vaultdropUserId: user.id,
          installationId: connection.githubInstallationId,
          repositoryId: 0, // Will be updated on sync
          owner,
          repositoryName: repo,
          defaultBranch: branch,
          lastSyncAt: new Date(),
        },
      }).catch(() => null);
    }

    // 8. In-app notification
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        type: 'github_repo_imported',
        title: 'Repository imported',
        message: `Imported "${owner}/${repo}" (${branch}) into workspace "${workspaceName}" (${fileRecords.length} files)`,
        workspaceId: workspace.id,
        metadata: JSON.stringify({
          repository: `${owner}/${repo}`,
          branch,
          filesImported: fileRecords.length,
        }),
      },
    });

    // 9. Audit log
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        workspaceId: workspace.id,
        repositoryName: `${owner}/${repo}`,
        operation: 'PULL',
        status: 'success',
        filesChanged: fileRecords.length,
        metadata: JSON.stringify({
          branch,
          workspaceName,
          filesImported: fileRecords.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      filesImported: fileRecords.length,
      totalBytes: Number(totalBytesSum),
    });
  } catch (error: any) {
    console.error('Import repository error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to import repository',
        details: {
          step: 'Import Repository',
          statusCode: 500,
          errorCode: 'IMPORT_FAILED',
          reason: error?.message || 'An error occurred while importing the repository.',
        },
      },
      { status: 500 }
    );
  }
}
