'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
  Radio,
  Activity,
  ChevronRight,
  FileCode,
  Zap,
  History,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

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
}

interface OperationItem {
  id: string;
  operation: string;
  status: string;
  repositoryName?: string;
  commitSha?: string;
  filesChanged?: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export default function GitHubDashboardPage() {
  const { data: session, status: authStatus } = useSession();

  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<GitHubStatusResponse | null>(null);
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const [recentOps, setRecentOps] = useState<OperationItem[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  // Workspaces mapping
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedRepoForLink, setSelectedRepoForLink] = useState<RepositoryItem | null>(null);
  const [linkingWorkspaceId, setLinkingWorkspaceId] = useState('');
  const [linking, setLinking] = useState(false);

  // View mode for repos
  const [repoView, setRepoView] = useState<'grid' | 'list'>('grid');

  const fetchRepositories = React.useCallback(async () => {
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

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/github/status');
      const data = await res.json();
      setStatusData(data);

      if (data.connected && data.connection?.hasInstallation) {
        fetchRepositories();
      }
    } catch (err) {
      console.error('Fetch status error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchRepositories]);

  const fetchWorkspaces = React.useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(
          (data.workspaces || []).map((w: any) => ({
            id: w.id,
            name: w.name,
            fileCount: w.totalFiles || w.fileCount || 0,
          }))
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session) {
      fetchStatus();
      fetchWorkspaces();
    } else if (authStatus !== 'loading') {
      setLoading(false);
    }
  }, [session, authStatus, fetchStatus, fetchWorkspaces]);

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
        setRecentOps([]);
      } else {
        toast.error('Failed to disconnect GitHub account.');
      }
    } catch {
      toast.error('Error disconnecting GitHub account.');
    } finally {
      setDisconnecting(false);
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
        toast.success(`Linked to workspace!`);
        setSelectedRepoForLink(null);
        setLinkingWorkspaceId('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to link workspace.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error linking workspace.');
    } finally {
      setLinking(false);
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
        <p className="text-xs text-neutral-500 font-mono tracking-wider">INITIALIZING GITHUB SYNC</p>
        <div className="mt-4 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-sky-500"
              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
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
            VaultDrop provides account-level GitHub synchronization across all your developer devices.
            Sign in to connect your GitHub account and start syncing.
          </p>
        </div>
        <Link
          href="/login?callbackUrl=/github"
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-sm hover:shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-0.5"
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-sky-950 dark:from-neutral-950 dark:via-neutral-950 dark:to-sky-950 p-8 sm:p-10 border border-neutral-800">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center backdrop-blur-sm">
                <GitBranch className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    GitHub Sync
                  </h1>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/20 uppercase tracking-widest">
                    VaultDrop Sync
                  </span>
                </div>
                <p className="text-sm text-neutral-400 mt-0.5">
                  Secure Git integration for VaultDrop workspaces
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <button
                  onClick={() => fetchStatus()}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <a
                  href={`https://github.com/settings/installations/${statusData?.connection?.installationId || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all"
                >
                  <span>Manage Access</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                </button>
              </>
            ) : (
              <a
                href="/api/github/connect"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-sm hover:shadow-lg hover:shadow-sky-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                <GitBranch className="w-4 h-4" />
                <span>Connect GitHub Account</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ─── Account Status Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Identity Card */}
        <div className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300 group">
          <div className="absolute top-4 right-4">
            {isConnected && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>

          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-3">
            Identity
          </span>

          <div className="flex items-center gap-3">
            {statusData?.connection?.githubAvatarUrl ? (
              <img
                src={statusData.connection.githubAvatarUrl}
                alt={statusData.connection.githubLogin}
                className="w-12 h-12 rounded-xl border-2 border-sky-500/20 object-cover shadow-sm group-hover:border-sky-500/40 transition-colors"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400">
                <GitBranch className="w-6 h-6" />
              </div>
            )}

            {isConnected ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono truncate">
                    @{statusData?.connection?.githubLogin}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 uppercase">
                    {statusData?.connection?.githubAccountType || 'User'}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Linked {formatRelativeTime(statusData!.connection!.connectedAt)}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-sm font-semibold text-neutral-500 block">Not connected</span>
                <span className="text-[11px] text-neutral-400">Connect to get started</span>
              </div>
            )}
          </div>
        </div>

        {/* Installation Status Card */}
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-3">
            App Installation
          </span>

          {hasInstallation ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block">
                    Active
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">VAULTDROP SYNC</span>
                </div>
              </div>
            </div>
          ) : isConnected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Installation Pending</span>
              </div>
              <a
                href={statusData?.appInstallationUrl || 'https://github.com/apps/vaultdrop-sync/installations/new'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-sky-500 hover:text-sky-400 font-semibold transition-colors"
              >
                <span>Complete Installation</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Shield className="w-4 h-4 text-neutral-400" />
              </div>
              <span className="text-xs text-neutral-400">Available after connection</span>
            </div>
          )}
        </div>

        {/* Repositories Count Card */}
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-3">
            Granted Repositories
          </span>

          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-extrabold font-mono text-neutral-900 dark:text-neutral-100 block leading-none">
                {repositories.length}
              </span>
              <span className="text-[11px] text-neutral-400 mt-1 block">repositories accessible</span>
            </div>
            {repositories.length > 0 && (
              <div className="flex -space-x-1">
                {repositories.slice(0, 4).map((r, i) => (
                  <div
                    key={r.id}
                    className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-500"
                    title={r.fullName}
                    style={{ zIndex: 4 - i }}
                  >
                    {r.name[0]?.toUpperCase()}
                  </div>
                ))}
                {repositories.length > 4 && (
                  <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-[8px] font-bold text-sky-500">
                    +{repositories.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Security & Cross-Device Badge ─── */}
      {isConnected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800/60">
          <div className="flex items-center gap-2.5 text-[11px] text-neutral-500">
            <Laptop className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>
              <strong className="text-neutral-700 dark:text-neutral-300">Cross-Device Enabled</strong> — Connection synced across Desktop, Laptop, and Mobile
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-400">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero tokens stored on client</span>
          </div>
        </div>
      )}

      {/* ─── Repository Browser ─── */}
      {isConnected && (
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/60 dark:border-neutral-800/60">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Repositories
                </h2>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  {repositories.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Repositories accessible through your VAULTDROP SYNC installation
              </p>
            </div>

            {/* Search & View Toggle */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/10 font-mono transition-all"
                />
              </div>
              <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={() => setRepoView('grid')}
                  className={`p-1.5 rounded-md text-xs transition-all ${repoView === 'grid' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-400'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                </button>
                <button
                  onClick={() => setRepoView('list')}
                  className={`p-1.5 rounded-md text-xs transition-all ${repoView === 'list' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-400'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Repository Content */}
          <div className="p-6 sm:p-8 pt-5">
            {loadingRepos ? (
              <div className="py-16 text-center space-y-3">
                <div className="relative inline-block">
                  <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
                </div>
                <p className="text-xs text-neutral-500 font-mono">Syncing repository manifest from GitHub...</p>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center mx-auto">
                  <FileCode className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                    {searchQuery ? 'No repositories match your search' : 'No accessible repositories found'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {searchQuery ? 'Try a different search term.' : 'Grant VAULTDROP SYNC access to your repositories.'}
                  </p>
                </div>
                {!searchQuery && (
                  <a
                    href={statusData?.appInstallationUrl || 'https://github.com/apps/vaultdrop-sync/installations/new'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors shadow-sm shadow-sky-500/20"
                  >
                    <span>Add Repositories</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className={repoView === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-2'}>
                {filteredRepos.map((repo) => (
                  repoView === 'grid' ? (
                    <div
                      key={repo.id}
                      className="group p-5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/30 border border-neutral-200/60 dark:border-neutral-800 hover:border-sky-500/30 dark:hover:border-sky-500/20 transition-all duration-300 hover:shadow-md flex flex-col justify-between text-xs space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-sm truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {repo.fullName}
                          </span>
                          {repo.private ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Private</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                              <Globe className="w-2.5 h-2.5" />
                              <span>Public</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-neutral-500 line-clamp-2 min-h-[32px] leading-relaxed">
                          {repo.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-neutral-400 flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {repo.defaultBranch}
                          </span>
                          <span className="text-neutral-300 dark:text-neutral-600 font-mono">
                            {formatRelativeTime(repo.updatedAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
                            title="View on GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={() => setSelectedRepoForLink(repo)}
                            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-[11px] transition-all flex items-center gap-1.5 shadow-sm shadow-sky-500/15 hover:shadow-sky-500/25"
                          >
                            <Layers className="w-3 h-3" />
                            <span>Link</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* List View */
                    <div
                      key={repo.id}
                      className="group flex items-center justify-between gap-4 p-3.5 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/20 border border-neutral-200/40 dark:border-neutral-800/40 hover:border-sky-500/20 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-xs truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {repo.fullName}
                        </span>
                        {repo.private ? (
                          <Lock className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                        ) : (
                          <Globe className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        )}
                        <span className="text-[10px] font-mono text-neutral-400 flex-shrink-0 hidden sm:inline">
                          {repo.defaultBranch}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => setSelectedRepoForLink(repo)}
                          className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-[11px] transition-colors"
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Link Workspace Modal ─── */}
      {selectedRepoForLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Link Repository
                </h3>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {selectedRepoForLink.fullName}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Select which VaultDrop workspace will sync with{' '}
              <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                {selectedRepoForLink.fullName}
              </strong>
              . You can commit files from this workspace directly to the repository.
            </p>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Target Workspace
              </label>
              <select
                value={linkingWorkspaceId}
                onChange={(e) => setLinkingWorkspaceId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all"
              >
                <option value="">Select a workspace...</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.fileCount} files)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRepoForLink(null)}
                className="px-4 py-2.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkWorkspace}
                disabled={!linkingWorkspaceId || linking}
                className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-sky-500/20"
              >
                {linking ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Linking...
                  </span>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
