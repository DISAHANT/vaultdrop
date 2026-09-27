'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Unlink,
  AlertCircle,
  PlusCircle,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  History,
  FileCode,
  ChevronRight,
  Zap,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConnectRepoModal } from './connect-repo-modal';
import { CommitModal } from './commit-modal';

interface WorkspaceGitHubPanelProps {
  workspaceId: string;
  workspaceName: string;
}

interface OperationItem {
  id: string;
  operation: string;
  status: string;
  repositoryName?: string;
  commitSha?: string;
  filesChanged?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export function WorkspaceGitHubPanel({ workspaceId, workspaceName }: WorkspaceGitHubPanelProps) {
  const [loading, setLoading] = useState(true);
  const [githubConnected, setGithubConnected] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState<any | null>(null);
  const [recentCommits, setRecentCommits] = useState<OperationItem[]>([]);

  // Modals
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      // Check GitHub account status
      const statusRes = await fetch('/api/github/status');
      const statusData = await statusRes.json();
      setGithubConnected(statusData.connected && statusData.connection?.hasInstallation);

      // Check workspace connected repo
      const repoRes = await fetch(`/api/github/workspace/${workspaceId}/connect`);
      const repoData = await repoRes.json();
      setConnectedRepo(repoData.repo || null);
    } catch (err) {
      console.error('Error fetching workspace GitHub status:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDisconnectRepo = async () => {
    if (!confirm('Are you sure you want to disconnect this repository from the workspace?')) return;

    try {
      setDisconnecting(true);
      const res = await fetch(`/api/github/workspace/${workspaceId}/connect`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Repository disconnected.');
        setConnectedRepo(null);
        setRecentCommits([]);
      } else {
        toast.error('Failed to disconnect repository.');
      }
    } catch {
      toast.error('Error disconnecting repository.');
    } finally {
      setDisconnecting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-center py-6 gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-sky-500" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sky-500 animate-ping" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 block">Checking GitHub connection</span>
            <span className="text-[10px] text-neutral-400 font-mono">Workspace: {workspaceName}</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Case 1: GitHub account not linked yet ───
  if (!githubConnected) {
    return (
      <div className="relative overflow-hidden bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-xl group">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/[0.02] to-indigo-500/[0.02] dark:from-sky-500/[0.03] dark:to-indigo-500/[0.03]" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 text-sky-500 border border-sky-500/15">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
                <span>GitHub Integration</span>
              </h3>
              <p className="text-xs text-neutral-500 max-w-lg mt-1 leading-relaxed">
                Connect your GitHub account to enable direct commits, CI/CD tracking, and automated
                workspace synchronization with VAULTDROP SYNC.
              </p>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  End-to-end secure
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Zero-config setup
                </span>
              </div>
            </div>
          </div>

          <a
            href={`/api/github/connect?returnUrl=/workspaces/${workspaceId}`}
            className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold text-xs hover:shadow-lg hover:shadow-sky-500/20 transition-all duration-300 hover:-translate-y-0.5 flex-shrink-0"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Connect GitHub</span>
          </a>
        </div>
      </div>
    );
  }

  // ─── Case 2: GitHub connected, but workspace not linked to a repository ───
  if (!connectedRepo) {
    return (
      <>
        <div className="relative overflow-hidden bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-sky-500/[0.02]" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="p-3.5 rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/15">
                  <GitBranch className="w-6 h-6" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-md bg-emerald-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Link Repository
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
                    GitHub Connected
                  </span>
                </div>
                <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">
                  Select a GitHub repository to enable direct commits and build tracking for{' '}
                  <strong className="text-neutral-700 dark:text-neutral-300">{workspaceName}</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/15 hover:shadow-sky-500/25 flex-shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Connect Repository</span>
            </button>
          </div>
        </div>

        <ConnectRepoModal
          isOpen={connectModalOpen}
          onClose={() => setConnectModalOpen(false)}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onConnected={(repo) => setConnectedRepo(repo)}
        />
      </>
    );
  }

  // ─── Case 3: Workspace connected to a GitHub repository! ───
  return (
    <>
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden">
        {/* ─ Repo Header ─ */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/60 dark:border-neutral-800/60">
          <div className="flex items-start gap-3.5">
            <div className="relative flex-shrink-0">
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/15">
                <GitBranch className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white dark:border-neutral-900" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                  {connectedRepo.owner}/{connectedRepo.repositoryName}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                  <GitBranch className="w-2.5 h-2.5 inline mr-1" />
                  {connectedRepo.defaultBranch}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Linked
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-neutral-400 font-mono flex-wrap">
                {connectedRepo.lastCommitSha && (
                  <span className="flex items-center gap-1">
                    <GitCommit className="w-3 h-3" />
                    <span className="text-neutral-600 dark:text-neutral-300 font-bold">
                      {connectedRepo.lastCommitSha.slice(0, 7)}
                    </span>
                  </span>
                )}
                {connectedRepo.lastSyncAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(connectedRepo.lastSyncAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCommitModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/15 hover:shadow-sky-500/25 hover:-translate-y-0.5 duration-200 cursor-pointer"
            >
              <GitCommit className="w-4 h-4" />
              <span>Commit Changes</span>
            </button>

            <a
              href={`https://github.com/${connectedRepo.owner}/${connectedRepo.repositoryName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 hover:text-sky-500 hover:border-sky-500/30 transition-all"
              title="Open Repository on GitHub"
            >
              <ArrowUpRight className="w-4 h-4" />
            </a>

            <button
              onClick={() => setConnectModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-all"
            >
              Change
            </button>

            <button
              onClick={handleDisconnectRepo}
              disabled={disconnecting}
              className="p-2.5 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all disabled:opacity-50"
              title="Disconnect Repository"
            >
              <Unlink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─ Status Footer ─ */}
        <div className="px-5 sm:px-6 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-400">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Safety filters active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-500" />
              <span>CI monitoring enabled</span>
            </div>
          </div>
          <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600 uppercase tracking-widest">
            VAULTDROP SYNC
          </span>
        </div>
      </div>

      <ConnectRepoModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onConnected={(repo) => setConnectedRepo(repo)}
      />

      <CommitModal
        isOpen={commitModalOpen}
        onClose={() => setCommitModalOpen(false)}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        connectedRepo={connectedRepo}
        onCommitSuccess={fetchStatus}
      />
    </>
  );
}
