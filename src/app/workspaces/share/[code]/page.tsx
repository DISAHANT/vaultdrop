'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FolderCode,
  Download,
  FileCode,
  CheckCircle2,
  ShieldAlert,
  Search,
  ArrowLeft,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Loader2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { getCategoryBadge } from '@/lib/workspace/categories';
import { toast } from 'sonner';

interface SharedWorkspaceDetails {
  id: string;
  name: string;
  shareCode: string;
  description?: string;
  framework?: string;
  language?: string;
  packageManager?: string;
  fileCount: number;
  totalBytes: number;
  skippedCount: number;
  healthReport?: any;
  ownerName: string;
  isOwner: boolean;
  createdAt: string;
  files: Array<{
    id: string;
    relativePath: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    category: string;
    isSensitive: boolean;
  }>;
}

export default function SharedWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase();

  const [workspace, setWorkspace] = useState<SharedWorkspaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetch(`/api/workspaces/share/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error('Workspace not found or expired');
        return res.json();
      })
      .then((data) => {
        setWorkspace(data.workspace);
      })
      .catch((err) => {
        toast.error(err.message || 'Failed to load workspace');
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleDownload = () => {
    if (!workspace) return;
    setDownloading(true);
    toast.info('Generating ZIP archive...');
    window.location.href = `/api/workspaces/${workspace.id}/download?code=${workspace.shareCode}`;
    setTimeout(() => setDownloading(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-20 px-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
          Loading Shared Workspace...
        </h2>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen pt-32 pb-20 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center mb-4">
          <FolderCode className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Workspace Not Found
        </h2>
        <p className="text-sm text-neutral-500 mb-6">
          This shared workspace link may have expired or is invalid.
        </p>
        <Link href="/codedrop" className="btn-primary px-6 py-2.5 text-sm inline-flex">
          Go to CodeDrop
        </Link>
      </div>
    );
  }

  const filteredFiles = workspace.files.filter((f) => {
    const matchesSearch = f.relativePath.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-3">
              <FolderCode className="w-3.5 h-3.5" />
              <span>Shared Developer Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white">
              {workspace.name}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Shared by <span className="font-semibold text-neutral-700 dark:text-neutral-300">{workspace.ownerName}</span> · Code: <code className="font-mono text-cyan-500 font-bold">{workspace.shareCode}</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-accent-cyan px-6 py-3 text-sm font-semibold shadow-lg shadow-cyan-500/20"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Project ZIP</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/50 dark:border-cyan-900/30">
            <span className="text-xs text-neutral-500 block">Total Files</span>
            <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
              {workspace.fileCount.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/30">
            <span className="text-xs text-neutral-500 block">Total Size</span>
            <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
              {formatBytes(workspace.totalBytes)}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/30">
            <span className="text-xs text-neutral-500 block">Framework / Stack</span>
            <span className="text-xl font-bold text-neutral-900 dark:text-white">
              {workspace.framework || 'Standard'}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30">
            <span className="text-xs text-neutral-500 block">Dependencies Skipped</span>
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              {workspace.skippedCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* File Explorer */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search files in workspace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {['all', 'code', 'config', 'asset', 'doc'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Files List */}
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-[500px] overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <p className="text-center py-10 text-xs text-neutral-500">No matching files found.</p>
          ) : (
            filteredFiles.map((file) => {
              const badge = getCategoryBadge(file.category as any);
              return (
                <div
                  key={file.id}
                  className="py-2.5 px-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-xl transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate mr-4">
                    <FileCode className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate">
                      {file.relativePath}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>
                    <span className="font-mono text-neutral-400 w-16 text-right">
                      {formatBytes(file.fileSize)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
