import { NextResponse } from 'next/server';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import prisma from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getInstallationAccessToken } from '@/lib/github/app';
import { putObject } from '@/lib/storage/object-storage';
import { isExcluded } from '@/lib/workspace/exclusions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { files: true },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 403 });
    }

    const repoMapping = await prisma.workspaceGitHubRepo.findFirst({
      where: {
        workspaceId,
        vaultdropUserId: user.id,
      },
    });

    if (!repoMapping) {
      return NextResponse.json(
        { error: 'No GitHub repository connected to this workspace.' },
        { status: 400 }
      );
    }

    const connection = await prisma.gitHubConnection.findFirst({
      where: {
        vaultdropUserId: user.id,
        status: 'active',
      },
    });

    if (!connection) {
      return NextResponse.json({ error: 'GitHub is not connected.' }, { status: 403 });
    }

    let token: string | null = null;
    if (connection.githubInstallationId) {
      try {
        token = await getInstallationAccessToken(connection.githubInstallationId);
      } catch {}
    }
    if (!token && connection.accessToken) {
      token = connection.accessToken;
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token unavailable' }, { status: 401 });
    }

    const owner = repoMapping.owner;
    const repo = repoMapping.repositoryName;
    const branch = repoMapping.defaultBranch || 'main';

    // 1. SAFETY: Create snapshot of current workspace before pulling
    const currentFilesCount = workspace.files.length;
    let snapshotId = null;
    try {
      const snap = await prisma.workspaceSnapshot.create({
        data: {
          workspaceId,
          snapshotNumber: (await prisma.workspaceSnapshot.count({ where: { workspaceId } })) + 1,
          name: `Pre-Pull Backup (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          description: `Automatic snapshot before pulling changes from ${owner}/${repo}@${branch}`,
          totalFiles: currentFilesCount,
          totalSize: workspace.totalSize,
          metadata: JSON.stringify(
            workspace.files.map((f) => ({
              relativePath: f.relativePath,
              checksum: f.checksum,
              fileSize: f.fileSize.toString(),
            }))
          ),
        },
      });
      snapshotId = snap.id;
    } catch (snapErr) {
      console.warn('Failed to create pre-pull snapshot:', snapErr);
    }

    // 2. Download zipball from GitHub
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
      return NextResponse.json(
        { error: `GitHub zipball download failed with status ${zipRes.status}` },
        { status: zipRes.status }
      );
    }

    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    if (zipEntries.length === 0) {
      return NextResponse.json({ error: 'Remote repository archive is empty' }, { status: 400 });
    }

    const rootPrefix = zipEntries[0].entryName.split('/')[0] + '/';

    // 3. Clear existing files and write new ones
    await prisma.workspaceFile.deleteMany({ where: { workspaceId } });

    const newFiles: any[] = [];
    let totalBytesSum = BigInt(0);

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      let cleanPath = entry.entryName;
      if (cleanPath.startsWith(rootPrefix)) {
        cleanPath = cleanPath.slice(rootPrefix.length);
      }
      if (!cleanPath || cleanPath.startsWith('.git/') || isExcluded(cleanPath)) continue;

      const fileData = entry.getData();
      const fileSize = BigInt(fileData.length);
      totalBytesSum += fileSize;

      const filename = cleanPath.split('/').pop() || cleanPath;
      const sha256Checksum = crypto.createHash('sha256').update(fileData).digest('hex');
      const fileKey = `workspaces/${workspaceId}/${cleanPath.replace(/\\/g, '/')}`;

      try {
        await putObject(fileKey, fileData, 'text/plain');
      } catch {}

      newFiles.push({
        workspaceId,
        relativePath: cleanPath,
        filename,
        fileSize,
        mimeType: 'text/plain',
        fileKey,
        checksum: sha256Checksum,
        category: 'code',
        isSensitive: false,
        uploadVerified: true,
      });
    }

    // Insert files in chunks
    for (let i = 0; i < newFiles.length; i += 50) {
      await prisma.workspaceFile.createMany({
        data: newFiles.slice(i, i + 50),
      });
    }

    // 4. Update workspace stats & repo mapping
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        totalFiles: newFiles.length,
        totalSize: totalBytesSum,
        verifiedFileCount: newFiles.length,
        workspaceStatus: 'READY',
      },
    });

    await prisma.workspaceGitHubRepo.update({
      where: { id: repoMapping.id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    // 5. In-app notification
    await prisma.notification.create({
      data: {
        recipientId: user.id,
        type: 'github_pull_success',
        title: 'Repository pulled',
        message: `Pulled ${newFiles.length} files from "${owner}/${repo}" (${branch}) into "${workspace.name}"`,
        workspaceId,
        metadata: JSON.stringify({
          repository: `${owner}/${repo}`,
          branch,
          filesUpdated: newFiles.length,
          snapshotId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      filesPulled: newFiles.length,
      snapshotId,
      branch,
    });
  } catch (error: any) {
    console.error('Pull repository error:', error);
    return NextResponse.json({ error: error?.message || 'Error pulling repository' }, { status: 500 });
  }
}
