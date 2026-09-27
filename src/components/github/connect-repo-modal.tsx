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
  FolderPlus,
  Sparkles,
  Layers,
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
  const [tab, setTab] = useState<'existing' | 'create'>('existing');
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsInstallation, setNeedsInstallation] = useState(false);
  const [installationUrl, setInstallationUrl] = useState('https://github.com/apps/vaultdrop-sync/installations/new');

  // Create repo form state
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [newRepoInitReadme, setNewRepoInitReadme] = useState(false);
  const [newRepoGitignore, setNewRepoGitignore] = useState('None');
  const [creatingRepo, setCreatingRepo] = useState(false);

  useEffect(() => {
    if (workspaceName) {
      setNewRepoName(workspaceName.toLowerCase().replace(/[^a-z0-9._-]/g, '-'));
    }
  }, [workspaceName]);

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

  const handleCreateAndConnectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) {
      toast.error('Repository name is required.');
      return;
    }

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
          workspaceId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create repository.');
        if (data.details?.reconnectUrl) {
          toast('GitHub authorization required', {
            action: {
              label: 'Reconnect',
              onClick: () => window.location.href = data.details.reconnectUrl,
            },
          });
        }
        return;
      }

      toast.success(`Created & linked ${data.repository.fullName}!`);
      if (data.linkedMapping) {
        onConnected(data.linkedMapping);
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Error creating repository.');
    } finally {
      setCreatingRepo(false);
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
                Push to GitHub
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

        {/* Destination Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30 p-1.5 gap-1.5">
          <button
            onClick={() => setTab('existing')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === 'existing'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Existing Repository</span>
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === 'create'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5 text-sky-500" />
            <span>+ Create New Repository</span>
          </button>
        </div>

        {tab === 'existing' ? (
          <>
            {/* Search Bar */}
            <div className="px-5 sm:px-6 py-3 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search repositories by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 font-mono transition-all"
                />
              </div>
            </div>

            {/* Existing Repositories List */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2">
              {loading ? (
                <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-sky-500 animate-spin" />
                  <p className="text-xs text-neutral-500 font-mono">Fetching repositories from GitHub...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-600 dark:text-rose-400 block mb-0.5">Failed to fetch repositories</span>
                    <p className="text-neutral-500">{error}</p>
                  </div>
                </div>
              ) : needsInstallation ? (
                <div className="p-6 text-center space-y-4">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                      App Installation Required
                    </h3>
                    <p className="text-xs text-neutral-500">
                      VAULTDROP SYNC needs to be installed on your GitHub account or selected repositories.
                    </p>
                  </div>
                  <a
                    href={installationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-md transition-all"
                  >
                    <span>Install VAULTDROP SYNC</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <FileCode className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500">
                    {searchQuery ? 'No repositories matching search query.' : 'No accessible repositories found.'}
                  </p>
                  <button
                    onClick={() => setTab('create')}
                    className="text-xs font-bold text-sky-500 hover:underline"
                  >
                    Create a new repository instead →
                  </button>
                </div>
              ) : (
                filtered.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/30 border border-neutral-200/60 dark:border-neutral-800 hover:border-sky-500/30 transition-all gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 text-xs font-mono truncate">
                          {repo.fullName}
                        </span>
                        {repo.private ? (
                          <Lock className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                        ) : (
                          <Globe className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {repo.description || 'No description'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleConnectRepo(repo)}
                      disabled={connectingId === repo.id}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 flex-shrink-0"
                    >
                      {connectingId === repo.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <span>Connect</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Create New Repository Form */
          <form onSubmit={handleCreateAndConnectRepo} className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Repository Name *
              </label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="my-awesome-project"
                required
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
                placeholder="Synchronized via VaultDrop"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Visibility
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  onClick={() => setNewRepoPrivate(true)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center gap-2.5 transition-all ${
                    newRepoPrivate
                      ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Private</span>
                </label>
                <label
                  onClick={() => setNewRepoPrivate(false)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center gap-2.5 transition-all ${
                    !newRepoPrivate
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Public</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  .gitignore Template
                </label>
                <select
                  value={newRepoGitignore}
                  onChange={(e) => setNewRepoGitignore(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 transition-all font-mono"
                >
                  <option value="None">None</option>
                  <option value="Node">Node</option>
                  <option value="Python">Python</option>
                  <option value="Go">Go</option>
                  <option value="Rust">Rust</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  Initialize README
                </label>
                <div className="flex items-center gap-4 pt-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!newRepoInitReadme}
                      onChange={() => setNewRepoInitReadme(false)}
                    />
                    <span>No</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={newRepoInitReadme}
                      onChange={() => setNewRepoInitReadme(true)}
                    />
                    <span>Yes</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setTab('existing')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={creatingRepo || !newRepoName.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {creatingRepo ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Repository...</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Create & Connect</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
