'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  FolderCode,
  Download,
  Send,
  Trash2,
  Calendar,
  Layers,
  ArrowLeft,
  HardDrive,
  Cpu,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Lock,
  Search,
  Camera,
  RefreshCw,
  FileCode,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { getCategoryBadge, FileCategory } from '@/lib/workspace/categories';
import SendToDeviceModal from '@/components/send-to-device-modal';
import { toast } from 'sonner';

interface WorkspaceDetails {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  totalBytes: number;
  skippedCount: number;
  skippedBytes: number;
  skippedReport?: any[];
  healthReport?: any;
  createdAt: string;
  updatedAt: string;
  files: Array<{
    id: string;
    relativePath: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    category: string;
    isSensitive: boolean;
    createdAt: string;
  }>;
  snapshots: Array<{
    id: string;
    name: string;
    description?: string;
    fileCount: number;
    totalBytes: number;
    createdAt: string;
  }>;
}

export default function WorkspaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlySensitive, setShowOnlySensitive] = useState(false);

  // Snapshot modal/form
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // Send to device modal
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const fetchWorkspace = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data.workspace);
      } else if (res.status === 404) {
        toast.error('Workspace not found.');
        router.push('/workspaces');
      }
    } catch (err) {
      console.error('Fetch workspace details error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchWorkspace();
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [params.id, session, status]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    try {
      setCreatingSnapshot(true);
      const res = await fetch(`/api/workspaces/${workspace.id}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: snapshotName || undefined,
          description: snapshotDesc || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Snapshot "${data.snapshot.name}" saved!`);
        setShowSnapshotModal(false);
        setSnapshotName('');
        setSnapshotDesc('');
        fetchWorkspace();
      } else {
        toast.error('Failed to create snapshot.');
      }
    } catch {
      toast.error('Error creating snapshot.');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
        <p className="text-sm text-neutral-500">Loading workspace files & analysis...</p>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  // Filtered files
  const filteredFiles = workspace.files.filter((f) => {
    const matchesSearch =
      f.relativePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesSensitive = !showOnlySensitive || f.isSensitive;
    return matchesSearch && matchesCategory && matchesSensitive;
  });

  const health = workspace.healthReport;
  const categoriesList = ['all', 'code', 'config', 'asset', 'doc', 'other'];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/workspaces" className="hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Workspaces</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{workspace.name}</span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <FolderCode className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
                  {workspace.name}
                </h1>
                {health?.framework && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {health.framework}
                  </span>
                )}
                {health?.language && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                    {health.language}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 max-w-xl">
                {workspace.description || 'Developer project workspace uploaded via CodeDrop'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowSnapshotModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100/70 dark:bg-neutral-800/70 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-all text-neutral-800 dark:text-neutral-200 shadow-sm"
            >
              <Camera className="w-4 h-4 text-indigo-500" />
              <span>Create Snapshot</span>
            </button>

            <button
              onClick={() => setSendModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white text-xs font-semibold transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Send to Device</span>
            </button>

            <a
              href={`/api/workspaces/${workspace.id}/download`}
              download={`${workspace.name}.zip`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-lg shadow-cyan-600/25"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP</span>
            </a>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
          <div>
            <span className="text-neutral-400 block mb-0.5">Workspace Files</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {workspace.fileCount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Total Size</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {formatBytes(workspace.totalBytes)}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Dependencies Skipped</span>
            <span className="text-lg font-bold text-rose-500 font-mono">
              {workspace.skippedCount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Snapshots Saved</span>
            <span className="text-lg font-bold text-indigo-500 font-mono">
              {workspace.snapshots.length}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Health & Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Health Card */}
        {health && (
          <div className="lg:col-span-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-500" />
                <span>Static Architecture & Health</span>
              </h3>
              <span className="text-xs text-neutral-400 font-mono">
                Package Manager: <strong className="text-neutral-700 dark:text-neutral-300">{health.packageManager}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {health.checks?.map((chk: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80"
                >
                  {chk.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {chk.name}
                    </span>
                    <p className="text-[11px] text-neutral-500">{chk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Snapshots Sidebar */}
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-500" />
                <span>Saved Snapshots</span>
              </h3>
              <span className="text-xs text-neutral-400 font-mono">{workspace.snapshots.length} total</span>
            </div>

            {workspace.snapshots.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center">
                No snapshots saved yet. Snapshots record a timestamped copy of this workspace state.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {workspace.snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                      <span>{s.name}</span>
                      <span className="font-mono text-neutral-400">{formatBytes(s.totalBytes)}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mb-2">{s.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono">{s.fileCount} files</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSnapshotModal(true)}
            className="w-full mt-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-colors"
          >
            + New Snapshot
          </button>
        </div>
      </div>

      {/* Files Explorer Section */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Workspace Files ({workspace.files.length})
            </h3>
            <p className="text-xs text-neutral-500">
              Relative directory structure preserved. Filter by developer categories or search paths.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search file path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-medium capitalize transition-all ${
                selectedCategory === cat
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => setShowOnlySensitive(!showOnlySensitive)}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all inline-flex items-center gap-1.5 ${
              showOnlySensitive
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Sensitive Only</span>
          </button>
        </div>

        {/* File Table */}
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-neutral-100/90 dark:bg-neutral-800/90 backdrop-blur-md text-neutral-500 uppercase font-mono tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Relative Path</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500">
                      No files matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => {
                    const badge = getCategoryBadge(file.category as FileCategory);
                    return (
                      <tr key={file.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 font-mono">
                        <td className="py-3 px-4 text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                          <span className="truncate max-w-md">{file.relativePath}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                            style={{ backgroundColor: badge.bg, borderColor: `${badge.color}40`, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {file.isSensitive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Lock className="w-3 h-3" />
                              <span>Sensitive</span>
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[10px]">Standard</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-neutral-500">{formatBytes(file.fileSize)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Snapshot Creation Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-500" />
              <span>Save Workspace Snapshot</span>
            </h3>
            <p className="text-xs text-neutral-500 mb-6">
              A snapshot preserves the current set of {workspace.fileCount} files as a point-in-time reference.
            </p>

            <form onSubmit={handleCreateSnapshot} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Snapshot Name
                </label>
                <input
                  type="text"
                  placeholder={`Snapshot ${String(workspace.snapshots.length + 1).padStart(2, '0')}`}
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Before major refactoring"
                  value={snapshotDesc}
                  onChange={(e) => setSnapshotDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSnapshotModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSnapshot}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md shadow-indigo-600/20"
                >
                  {creatingSnapshot ? 'Saving...' : 'Save Snapshot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send to Device Modal */}
      {workspace && (
        <SendToDeviceModal
          isOpen={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          itemTitle={`Workspace: ${workspace.name}`}
          itemType="workspace"
          itemPayload={{
            workspaceId: workspace.id,
            projectName: workspace.name,
            fileCount: workspace.fileCount,
            totalBytes: workspace.totalBytes,
          }}
        />
      )}
    </div>
  );
}
