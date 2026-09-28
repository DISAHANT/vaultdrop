'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GitBranch,
  GitCommit,
  Lock,
  Globe,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Layers,
  ArrowUpRight,
  Shield,
  Laptop,
  Unlink,
  Check,
  Clock,
  Activity,
  FileCode,
  Zap,
  ArrowRight,
  FolderPlus,
  Download,
  AlertTriangle,
  FolderCode,
  Cpu,
  Info,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { CommitModal } from '@/components/github/commit-modal';

interface GitHubStatusResponse {
  connected: boolean;
  connection?: {
    id: string;
    githubLogin: string;
    githubAvatarUrl?: string;
    githubAccountType: string;
    installationId: number | null;
    hasInstallation: boolean;
    connectedAt: string;
  } | null;
  repoCount: number;
  appInstallationUrl: string;
}

interface RepositoryItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar?: string;
  private: boolean;
  defaultBranch: string;
  description?: string | null;
  updatedAt: string;
  htmlUrl: string;
}

interface WorkspaceItem {
  id: string;
  name: string;
  fileCount: number;
  totalBytes: number;
  connectedRepo?: {
    id: string;
    owner: string;
    repositoryName: string;
    defaultBranch: string;
    lastCommitSha?: string;
    lastSyncAt?: string;
  } | null;
}

interface OperationItem {
  id: string;
  workspaceId?: string;
  operation: string;
  status: string;
  repositoryName?: string;
  commitSha?: string;
  filesChanged?: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  metadata?: any;
}

function GitHubDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();

  const [activeTab, setActiveTab] = useState<'repos' | 'workspaces' | 'activity'>('repos');
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<GitHubStatusResponse | null>(null);
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [repoView, setRepoView] = useState<'grid' | 'list'>('grid');
  const [disconnecting, setDisconnecting] = useState(false);

  // Workspaces data
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Operations/Activity data
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [loadingOperations, setLoadingOperations] = useState(false);

  // ─── Modal States ───
  // Create Repository Modal
  const [createRepoModalOpen, setCreateRepoModalOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [newRepoInitReadme, setNewRepoInitReadme] = useState(false);
  const [newRepoGitignore, setNewRepoGitignore] = useState('None');
  const [newRepoWorkspaceLink, setNewRepoWorkspaceLink] = useState('');
  const [creatingRepo, setCreatingRepo] = useState(false);

  // Import Repository Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedRepoForImport, setSelectedRepoForImport] = useState<RepositoryItem | null>(null);
  const [importBranch, setImportBranch] = useState('main');
  const [importWorkspaceName, setImportWorkspaceName] = useState('');
  const [importing, setImporting] = useState(false);

  // Link Workspace Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedRepoForLink, setSelectedRepoForLink] = useState<RepositoryItem | null>(null);
  const [linkingWorkspaceId, setLinkingWorkspaceId] = useState('');
  const [linking, setLinking] = useState(false);

  // Commit Modal
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [activeWorkspaceForCommit, setActiveWorkspaceForCommit] = useState<WorkspaceItem | null>(null);

  // Diagnostics Modal
  const [selectedOpForDiag, setSelectedOpForDiag] = useState<OperationItem | null>(null);

  // Commits & Branches Viewer Modal
  const [repoViewerModalOpen, setRepoViewerModalOpen] = useState(false);
  const [selectedRepoForViewer, setSelectedRepoForViewer] = useState<RepositoryItem | null>(null);
  const [repoViewerCommits, setRepoViewerCommits] = useState<any[]>([]);
  const [repoViewerBranches, setRepoViewerBranches] = useState<any[]>([]);
  const [repoViewerBranch, setRepoViewerBranch] = useState('main');
  const [loadingRepoViewer, setLoadingRepoViewer] = useState(false);

  const fetchRepositories = useCallback(async () => {
    try {
      setLoadingRepos(true);
      const res = await fetch('/api/github/repositories');
      const data = await res.json();
      if (res.ok) {
        setRepositories(data.repositories || []);
      }
    } catch (err) {
      console.error('Fetch repos error:', err);
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  const fetchWorkspaces = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (!silent) setLoadingWorkspaces(true);
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        const wsList = data.workspaces || [];

        // For each workspace, check if linked to a GitHub repo
        const enriched = await Promise.all(
          wsList.map(async (w: any) => {
            let connectedRepo = null;
            try {
              const rRes = await fetch(`/api/github/workspace/${w.id}/connect`);
              if (rRes.ok) {
                const rData = await rRes.json();
                connectedRepo = rData.repo || null;
              }
            } catch {}
            return {
              id: w.id,
              name: w.name,
              fileCount: w.totalFiles || w.fileCount || 0,
              totalBytes: w.totalBytes || 0,
              connectedRepo,
            };
          })
        );
        setWorkspaces(enriched);
      }
    } catch (err) {
      console.error('Fetch workspaces error:', err);
    } finally {
      if (!silent) setLoadingWorkspaces(false);
    }
  }, []);

  const fetchOperations = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (!silent) setLoadingOperations(true);
      const res = await fetch('/api/github/operations?limit=30');
      if (res.ok) {
        const data = await res.json();
        setOperations(data.operations || []);
      }
    } catch (err) {
      console.error('Fetch operations error:', err);
    } finally {
      if (!silent) setLoadingOperations(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/github/status');
      const data = await res.json();
      setStatusData(data);

      if (data.connected && data.connection?.hasInstallation) {
        fetchRepositories();
        fetchWorkspaces();
        fetchOperations();
      }
    } catch (err) {
      console.error('Fetch status error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchRepositories, fetchWorkspaces, fetchOperations]);

  useEffect(() => {
    if (session) {
      fetchStatus();
    } else if (authStatus !== 'loading') {
      setLoading(false);
    }
  }, [session, authStatus, fetchStatus]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const connectedParam = searchParams.get('connected');
    const needsInstParam = searchParams.get('needs_installation');

    if (errorParam) {
      toast.error('GitHub Connection Issue: ' + decodeURIComponent(errorParam), { duration: 6000 });
      router.replace('/github');
    } else if (connectedParam) {
      toast.success('GitHub account connected successfully!', { duration: 4000 });
      fetchStatus();
      router.replace('/github');
    } else if (needsInstParam) {
      toast.info('GitHub account authorized! Please install the VAULTDROP SYNC app on your repositories.', {
        duration: 8000,
      });
      fetchStatus();
      router.replace('/github');
    }
  }, [searchParams, router, fetchStatus]);

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your GitHub account from VaultDrop?')) return;

    try {
      setDisconnecting(true);
      const res = await fetch('/api/github/disconnect', { method: 'POST' });
      if (res.ok) {
        toast.success('GitHub account disconnected.');
        setStatusData({
          connected: false,
          connection: null,
          repoCount: 0,
          appInstallationUrl: 'https://github.com/apps/vaultdrop-sync/installations/new',
        });
        setRepositories([]);
        setWorkspaces([]);
        setOperations([]);
      } else {
        toast.error('Failed to disconnect GitHub account.');
      }
    } catch {
      toast.error('Error disconnecting GitHub account.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;

    try {
      setCreatingRepo(true);
      const res = await fetch('/api/github/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRepoName.trim(),
          description: newRepoDesc.trim(),
          isPrivate: newRepoPrivate,
          autoInit: newRepoInitReadme,
          gitignoreTemplate: newRepoGitignore,
          workspaceId: newRepoWorkspaceLink || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create repository.');
        if (data.details?.reconnectUrl) {
          toast('GitHub authorization needed', {
            action: {
              label: 'Reconnect',
              onClick: () => (window.location.href = data.details.reconnectUrl),
            },
          });
        }
        return;
      }

      toast.success(`Repository ${data.repository.fullName} created!`);
      setCreateRepoModalOpen(false);
      setNewRepoName('');
      setNewRepoDesc('');
      fetchRepositories();
      fetchWorkspaces();
      fetchOperations();
    } catch (err: any) {
      toast.error(err?.message || 'Error creating repository.');
    } finally {
      setCreatingRepo(false);
    }
  };

  const openImportModal = (repo: RepositoryItem) => {
    setSelectedRepoForImport(repo);
    setImportBranch(repo.defaultBranch || 'main');
    setImportWorkspaceName(repo.name);
    setImportModalOpen(true);
  };

  const handleImportRepo = async () => {
    if (!selectedRepoForImport) return;

    try {
      setImporting(true);
      const res = await fetch(
        `/api/github/repositories/${encodeURIComponent(selectedRepoForImport.owner)}/${encodeURIComponent(selectedRepoForImport.name)}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch: importBranch,
            workspaceName: importWorkspaceName.trim() || selectedRepoForImport.name,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to import repository.');
        return;
      }

      toast.success(`Imported ${data.filesImported} files into "${data.workspaceName}"!`);
      setImportModalOpen(false);
      fetchWorkspaces();
      fetchOperations();
    } catch (err: any) {
      toast.error(err?.message || 'Error importing repository.');
    } finally {
      setImporting(false);
    }
  };

  const handleLinkWorkspace = async () => {
    if (!selectedRepoForLink || !linkingWorkspaceId) return;

    try {
      setLinking(true);
      const res = await fetch(`/api/github/workspace/${linkingWorkspaceId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: selectedRepoForLink.id,
          owner: selectedRepoForLink.owner,
          repositoryName: selectedRepoForLink.name,
          defaultBranch: selectedRepoForLink.defaultBranch || 'main',
        }),
      });

      if (res.ok) {
        toast.success(`Connected to workspace!`);
        setLinkModalOpen(false);
        setSelectedRepoForLink(null);
        setLinkingWorkspaceId('');
        fetchWorkspaces();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to connect workspace.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error connecting workspace.');
    } finally {
      setLinking(false);
    }
  };

  const openRepoViewer = async (repo: RepositoryItem) => {
    setSelectedRepoForViewer(repo);
    setRepoViewerBranch(repo.defaultBranch || 'main');
    setRepoViewerModalOpen(true);
    setLoadingRepoViewer(true);

    try {
      // Fetch branches
      const bRes = await fetch(`/api/github/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/branches`);
      if (bRes.ok) {
        const bData = await bRes.json();
        setRepoViewerBranches(bData.branches || []);
      }

      // Fetch commits
      const cRes = await fetch(`/api/github/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits?branch=${encodeURIComponent(repo.defaultBranch || 'main')}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        setRepoViewerCommits(cData.commits || []);
      }
    } catch (err) {
      console.error('Error fetching repo details:', err);
    } finally {
      setLoadingRepoViewer(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Loading State
  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/20 flex items-center justify-center mb-6 mx-auto animate-pulse">
            <GitBranch className="w-7 h-7 text-sky-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 animate-ping" />
        </div>
        <p className="text-xs text-neutral-500 font-mono tracking-wider">INITIALIZING DEVELOPER WORKSPACE</p>
      </div>
    );
  }

  // Not Authenticated
  if (!session) {
    return (
      <div className="min-h-screen pt-32 pb-20 px-4 max-w-lg mx-auto text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 text-sky-500 border border-sky-500/15 flex items-center justify-center mx-auto">
            <GitBranch className="w-9 h-9" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-neutral-900 dark:bg-white border-2 border-white dark:border-neutral-900 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-white dark:text-neutral-900" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Sign In to Access GitHub
          </h1>
          <p className="text-sm text-neutral-500 leading-relaxed">
            VaultDrop connects directly with your GitHub account, allowing seamless two-way code synchronization, branch switching, and automated commits.
          </p>
        </div>
        <Link
          href="/login?callbackUrl=/github"
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-sm hover:shadow-lg transition-all"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const isConnected = !!(statusData?.connected && statusData?.connection);
  const hasInstallation = !!statusData?.connection?.hasInstallation;
  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-sky-950 dark:from-neutral-950 dark:via-neutral-950 dark:to-sky-950 p-5 sm:p-10 border border-neutral-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-start sm:items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                <GitBranch className="w-6 h-6 text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight break-words">
                    GitHub Developer Workspace
                  </h1>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/20 uppercase tracking-widest whitespace-nowrap">
                    SYNC 2.0
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                  Move code seamlessly between VaultDrop workspaces and GitHub repositories
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isConnected ? (
              <>
                <button
                  onClick={() => fetchStatus()}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCreateRepoModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ Create Repository</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? '...' : 'Disconnect'}</span>
                </button>
              </>
            ) : (
              <a
                href="/api/github/connect"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-sm hover:shadow-lg transition-all"
              >
                <GitBranch className="w-4 h-4" />
                <span>Connect GitHub Account</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ─── Connected Account Status Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Identity Card */}
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            {statusData?.connection?.githubAvatarUrl ? (
              <img
                src={statusData.connection.githubAvatarUrl}
                alt={statusData.connection.githubLogin}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-sky-500/20 object-cover shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400 flex-shrink-0">
                <GitBranch className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                Connected User
              </span>
              {isConnected ? (
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                  <strong className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono truncate max-w-[140px] sm:max-w-none">
                    @{statusData?.connection?.githubLogin}
                  </strong>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    {statusData?.connection?.githubAccountType}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-neutral-500">Not connected</span>
              )}
            </div>
          </div>
          {isConnected && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" title="Connected" />
          )}
        </div>

        {/* Installation Status */}
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-1">
              App Permissions
            </span>
            {hasInstallation ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  Full Read & Write Active
                </span>
              </div>
            ) : isConnected ? (
              <a
                href={statusData?.appInstallationUrl || 'https://github.com/apps/vaultdrop-sync/installations/new'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1"
              >
                <span>Complete Installation</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            ) : (
              <span className="text-xs text-neutral-400">Requires connection</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-neutral-400 uppercase flex-shrink-0 ml-2">VAULTDROP SYNC</span>
        </div>

        {/* Statistics */}
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-1">
              Developer Scope
            </span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span><strong>{repositories.length}</strong> repos</span>
              <span><strong>{workspaces.length}</strong> workspaces</span>
            </div>
          </div>
          <Layers className="w-6 h-6 text-sky-500/40 flex-shrink-0" />
        </div>
      </div>

      {/* ─── Installation Required Banner ─── */}
      {isConnected && !hasInstallation && (
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-xl">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                Action Required: Install VAULTDROP SYNC on your repositories
              </h4>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed max-w-2xl">
                Your GitHub account <strong className="text-white font-mono">@{statusData?.connection?.githubLogin}</strong> is connected, but repository access requires installing the VAULTDROP SYNC GitHub App.
              </p>
            </div>
          </div>
          <a
            href={statusData?.appInstallationUrl || 'https://github.com/apps/vaultdrop-sync/installations/new'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 hover:brightness-110 transition-all flex-shrink-0"
          >
            <span>Install GitHub App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ─── Navigation Tabs ─── */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-2 sm:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('repos')}
          className={`pb-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'repos'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Repositories ({repositories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('workspaces')}
          className={`pb-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'workspaces'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <FolderCode className="w-4 h-4" />
          <span>Workspaces ({workspaces.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'activity'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Sync & Commit Activity ({operations.length})</span>
        </button>
      </div>

      {/* ─── TAB 1: REPOSITORIES ─── */}
      {activeTab === 'repos' && (
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden">
          {/* Controls Bar */}
          <div className="p-5 sm:p-6 border-b border-neutral-200/60 dark:border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 font-mono transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateRepoModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Create Repository</span>
              </button>
            </div>
          </div>

          {/* Repos Grid */}
          <div className="p-5 sm:p-6">
            {loadingRepos ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-sky-500 animate-spin mx-auto" />
                <p className="text-xs text-neutral-400 font-mono">Syncing repositories from GitHub...</p>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <FileCode className="w-10 h-10 text-neutral-400 mx-auto" />
                <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  {searchQuery ? 'No repositories match your search' : 'No accessible repositories found'}
                </p>
                <button
                  onClick={() => setCreateRepoModalOpen(true)}
                  className="text-xs font-bold text-sky-500 hover:underline"
                >
                  Create a new GitHub repository now →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/30 border border-neutral-200/60 dark:border-neutral-800 hover:border-sky-500/30 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-sm truncate block">
                            {repo.fullName}
                          </span>
                        </div>
                        {repo.private ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex-shrink-0">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <Globe className="w-2.5 h-2.5" /> Public
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-500 line-clamp-2 min-h-[32px] leading-relaxed">
                        {repo.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" /> {repo.defaultBranch}
                        </span>
                        <span>{formatRelativeTime(repo.updatedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Commits & Branches Viewer */}
                        <button
                          onClick={() => openRepoViewer(repo)}
                          className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-sky-500 text-[11px] font-semibold transition-colors"
                          title="View commits & branches"
                        >
                          Commits
                        </button>

                        {/* Import to VaultDrop */}
                        <button
                          onClick={() => openImportModal(repo)}
                          className="px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 text-[11px] font-bold flex items-center gap-1 transition-all"
                          title="Import repository into a VaultDrop workspace"
                        >
                          <Download className="w-3 h-3" />
                          <span>Import</span>
                        </button>

                        {/* Connect Workspace */}
                        <button
                          onClick={() => {
                            setSelectedRepoForLink(repo);
                            setLinkModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Layers className="w-3 h-3" />
                          <span>Connect</span>
                        </button>

                        {/* Link to GitHub */}
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
                          title="Open on GitHub"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: WORKSPACES ─── */}
      {activeTab === 'workspaces' && (
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              VaultDrop Workspaces & GitHub Sync
            </h2>
            <p className="text-xs text-neutral-500">
              Manage code commits and branch references for all your local workspaces
            </p>
          </div>

          {loadingWorkspaces ? (
            <div className="py-14 text-center">
              <RefreshCw className="w-6 h-6 text-sky-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-neutral-400 font-mono">Loading workspaces...</p>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <FolderCode className="w-10 h-10 text-neutral-400 mx-auto" />
              <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                No VaultDrop workspaces found
              </p>
              <Link href="/codedrop" className="text-xs font-bold text-sky-500 hover:underline">
                Upload a workspace with CodeDrop →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {workspaces.map((ws) => (
                <div key={ws.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <strong className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono break-all">
                        {ws.name}
                      </strong>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {ws.fileCount} files
                      </span>
                    </div>

                    {ws.connectedRepo ? (
                      <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-semibold break-all">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{ws.connectedRepo.owner}/{ws.connectedRepo.repositoryName}</span>
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          ({ws.connectedRepo.defaultBranch})
                        </span>
                        {ws.connectedRepo.lastCommitSha && (
                          <span className="text-[10px] font-mono text-sky-500">
                            Commit: {ws.connectedRepo.lastCommitSha.slice(0, 7)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-400">
                        Not connected to GitHub
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {ws.connectedRepo ? (
                      <>
                        <button
                          onClick={() => {
                            setActiveWorkspaceForCommit(ws);
                            setCommitModalOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
                        >
                          <GitCommit className="w-3.5 h-3.5" />
                          <span>Commit Changes</span>
                        </button>
                        <Link
                          href={`/workspaces/${ws.id}`}
                          className="px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-sky-500 transition-colors"
                        >
                          Manage
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/workspaces/${ws.id}`}
                        className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Push to GitHub</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: ACTIVITY & COMMITS ─── */}
      {activeTab === 'activity' && (
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Audit Trail & Operation History
              </h2>
              <p className="text-xs text-neutral-500">
                Cryptographically tracked commits, pulls, and webhook sync events
              </p>
            </div>
            <button
              onClick={() => fetchOperations()}
              disabled={loadingOperations}
              className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOperations ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingOperations ? (
            <div className="py-14 text-center">
              <RefreshCw className="w-6 h-6 text-sky-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-neutral-400 font-mono">Fetching activity history...</p>
            </div>
          ) : operations.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Activity className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs text-neutral-500">No Git operations recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {operations.map((op) => (
                <div key={op.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${
                      op.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : op.status === 'failed'
                        ? 'bg-rose-500/10 text-rose-500'
                        : 'bg-sky-500/10 text-sky-500'
                    }`}>
                      {op.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : op.status === 'failed' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono uppercase whitespace-nowrap">
                          {op.operation}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          op.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : op.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-sky-500/10 text-sky-500'
                        }`}>
                          {op.status}
                        </span>
                        {op.repositoryName && (
                          <span className="text-neutral-400 font-mono break-all">
                            {op.repositoryName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono flex-wrap">
                        <span>{formatRelativeTime(op.startedAt)}</span>
                        {op.commitSha && (
                          <span>Commit: <strong className="text-sky-500">{op.commitSha.slice(0, 7)}</strong></span>
                        )}
                        {op.filesChanged !== null && op.filesChanged !== undefined && (
                          <span>{op.filesChanged} files</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {op.status === 'failed' && (
                    <button
                      onClick={() => setSelectedOpForDiag(op)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold transition-colors flex items-center gap-1 self-start sm:self-center"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Diagnostics</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: CREATE REPOSITORY ─── */}
      {createRepoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <FolderPlus className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Create GitHub Repository
                </h3>
              </div>
              <button
                onClick={() => setCreateRepoModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRepo} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Repository Name *
                </label>
                <input
                  type="text"
                  placeholder="vaultdrop-mobile"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Created and synchronized via VaultDrop"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewRepoPrivate(true)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                      newRepoPrivate
                        ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Private</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRepoPrivate(false)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                      !newRepoPrivate
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    .gitignore Template
                  </label>
                  <select
                    value={newRepoGitignore}
                    onChange={(e) => setNewRepoGitignore(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono"
                  >
                    <option value="None">None</option>
                    <option value="Node">Node</option>
                    <option value="Python">Python</option>
                    <option value="Go">Go</option>
                    <option value="Rust">Rust</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Link Workspace
                  </label>
                  <select
                    value={newRepoWorkspaceLink}
                    onChange={(e) => setNewRepoWorkspaceLink(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="">None (Do not link)</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCreateRepoModalOpen(false)}
                  className="px-4 py-2 font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRepo || !newRepoName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingRepo ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Create Repository</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: IMPORT REPOSITORY ─── */}
      {importModalOpen && selectedRepoForImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Download className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Import to VaultDrop
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {selectedRepoForImport.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={importWorkspaceName}
                  onChange={(e) => setImportWorkspaceName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Branch to Download
                </label>
                <input
                  type="text"
                  value={importBranch}
                  onChange={(e) => setImportBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono"
                />
              </div>

              <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-700 dark:text-teal-300 text-[11px] leading-relaxed">
                VaultDrop will fetch the branch archive directly from GitHub, calculate deterministic SHA-256 checksums, and generate a new workspace.
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportRepo}
                  disabled={importing || !importWorkspaceName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Downloading & Packaging...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Import Workspace</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONNECT WORKSPACE TO REPO ─── */}
      {linkModalOpen && selectedRepoForLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <Layers className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Connect Workspace
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {selectedRepoForLink.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLinkModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  Select Target Workspace
                </label>
                <select
                  value={linkingWorkspaceId}
                  onChange={(e) => setLinkingWorkspaceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono"
                >
                  <option value="">Select a workspace...</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.fileCount} files)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="px-4 py-2 font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLinkWorkspace}
                  disabled={linking || !linkingWorkspaceId}
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {linking ? 'Connecting...' : 'Connect Workspace'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: COMMITS & BRANCHES VIEWER ─── */}
      {repoViewerModalOpen && selectedRepoForViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <GitCommit className="w-5 h-5 text-sky-500" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                    {selectedRepoForViewer.fullName}
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Branch: {repoViewerBranch}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setRepoViewerModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {loadingRepoViewer ? (
                <div className="py-10 text-center">
                  <RefreshCw className="w-5 h-5 text-sky-500 animate-spin mx-auto mb-2" />
                  <p className="text-neutral-400">Loading commit log...</p>
                </div>
              ) : repoViewerCommits.length === 0 ? (
                <div className="py-10 text-center text-neutral-400">No commits found on this branch.</div>
              ) : (
                repoViewerCommits.map((c) => (
                  <div key={c.sha} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-0.5">
                        {c.message}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                        <span>{c.authorName}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(c.date)}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-md flex-shrink-0">
                      {c.shortSha}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DIAGNOSTICS VIEWER ─── */}
      {selectedOpForDiag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Operation Failure Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setSelectedOpForDiag(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-mono">
                {selectedOpForDiag.errorMessage || 'Operation encountered an unexpected failure.'}
              </div>

              {selectedOpForDiag.errorCode && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">
                  <span className="text-neutral-400">Error Code:</span>
                  <strong className="text-neutral-800 dark:text-neutral-200">{selectedOpForDiag.errorCode}</strong>
                </div>
              )}

              <div className="text-neutral-500 text-[11px] leading-relaxed">
                Suggested Fix: Verify repository write permissions, ensure remote branch is up to date, or generate a fresh branch from the current head.
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setSelectedOpForDiag(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: COMMIT CHANGES ─── */}
      {commitModalOpen && activeWorkspaceForCommit && activeWorkspaceForCommit.connectedRepo && (
        <CommitModal
          isOpen={commitModalOpen}
          onClose={() => {
            setCommitModalOpen(false);
            setActiveWorkspaceForCommit(null);
          }}
          workspaceId={activeWorkspaceForCommit.id}
          workspaceName={activeWorkspaceForCommit.name}
          connectedRepo={activeWorkspaceForCommit.connectedRepo}
          onCommitSuccess={() => {
            fetchWorkspaces({ silent: true });
            fetchOperations({ silent: true });
          }}
        />
      )}
    </div>
  );
}

export default function GitHubDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
        </div>
      }
    >
      <GitHubDashboardContent />
    </Suspense>
  );
}
