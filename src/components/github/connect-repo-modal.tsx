'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Search,
  Lock,
  Globe,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  X,
  AlertCircle,
  PlusCircle,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

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
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  onConnected: (repo: any) => void;
}

export function ConnectRepoModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  onConnected,
}: ConnectRepoModalProps) {
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsInstallation, setNeedsInstallation] = useState(false);
  const [installationUrl, setInstallationUrl] = useState('https://github.com/apps/vaultdrop-sync/installations/new');

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

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/github/repositories');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load GitHub repositories.');
        return;
      }

      if (!data.hasInstallation) {
        setNeedsInstallation(true);
        if (data.appInstallationUrl) setInstallationUrl(data.appInstallationUrl);
      } else {
        setNeedsInstallation(false);
        setRepositories(data.repositories || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while fetching repositories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRepositories();
    }
  }, [isOpen]);

  const handleConnectRepo = async (repo: RepositoryItem) => {
    try {
      setConnectingId(repo.id);
      const res = await fetch(`/api/github/workspace/${workspaceId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repo.id,
          owner: repo.owner,
          repositoryName: repo.name,
          defaultBranch: repo.defaultBranch || 'main',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to connect repository.');
        return;
      }

      toast.success(`Connected to ${repo.fullName}!`);
      onConnected(data.repo);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Error connecting repository.');
    } finally {
      setConnectingId(null);
    }
  };

  if (!isOpen) return null;

  const filtered = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 text-sky-500 border border-sky-500/20 flex items-center justify-center">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Connect Repository
              </h2>
              <p className="text-[11px] text-neutral-500">
                Link <strong className="text-neutral-700 dark:text-neutral-300">{workspaceName}</strong> to a repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search repositories by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all font-mono"
            />
          </div>
        </div>

        {/* Body content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/15 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-sky-500 animate-spin" />
              </div>
              <p className="text-xs text-neutral-500 font-mono">Fetching repositories from GitHub...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/8 border border-rose-500/15 text-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-rose-700 dark:text-rose-300 mb-1">{error}</p>
                <button
                  onClick={fetchRepositories}
                  className="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : needsInstallation ? (
            <div className="p-6 rounded-2xl bg-amber-500/8 border border-amber-500/15 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-sm text-amber-700 dark:text-amber-300">
                  VAULTDROP SYNC Not Installed
                </p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  Grant VAULTDROP SYNC access to your repositories to enable linking.
                </p>
              </div>
              <a
                href={installationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-neutral-950 rounded-xl font-bold text-xs hover:bg-amber-400 transition-colors shadow-sm"
              >
                <span>Install VAULTDROP SYNC</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center mx-auto">
                <FileCode className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  {searchQuery ? 'No repositories match your search' : 'No accessible repositories'}
                </p>
              </div>
              <a
                href={installationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-500 hover:text-sky-400 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
              >
                <span>Configure access on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            filtered.map((repo) => (
              <div
                key={repo.id}
                className="group p-3.5 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/20 border border-neutral-200/50 dark:border-neutral-800/50 hover:border-sky-500/25 transition-all flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate font-mono group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {repo.fullName}
                    </span>
                    {repo.private ? (
                      <Lock className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    ) : (
                      <Globe className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {repo.description && (
                      <span className="text-[11px] text-neutral-500 truncate">{repo.description}</span>
                    )}
                    <span className="text-[10px] font-mono text-neutral-400 flex-shrink-0 hidden sm:inline">
                      {formatRelativeTime(repo.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
                    title="Open on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleConnectRepo(repo)}
                    disabled={connectingId === repo.id}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-[11px] transition-all flex items-center gap-1.5 shadow-sm shadow-sky-500/15 disabled:opacity-50"
                  >
                    {connectingId === repo.id ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Linking...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30 flex items-center justify-between text-xs">
          <a
            href={installationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-sky-500 inline-flex items-center gap-1 transition-colors"
          >
            <span>Configure access</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
