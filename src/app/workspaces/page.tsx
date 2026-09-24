'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  FolderCode,
  Download,
  Send,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  HardDrive,
  Cpu,
  Plus,
  RefreshCw,
  Eye,
  Camera,
  Archive,
} from 'lucide-react';
import SendToDeviceModal from '@/components/send-to-device-modal';
import { toast } from 'sonner';

interface WorkspaceSummary {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  totalBytes: number;
  skippedCount: number;
  skippedBytes: number;
  healthReport?: any;
  snapshotsCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function WorkspacesPage() {
  const { data: session, status } = useSession();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Send to device state
  const [selectedWorkspaceForSend, setSelectedWorkspaceForSend] = useState<WorkspaceSummary | null>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (err) {
      console.error('Fetch workspaces error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchWorkspaces();
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [session, status]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workspace "${name}"? All files will be removed.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Workspace "${name}" deleted.`);
        setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      } else {
        toast.error('Failed to delete workspace.');
      }
    } catch {
      toast.error('Network error deleting workspace.');
    }
  };

  const totalFiles = workspaces.reduce((acc, w) => acc + w.fileCount, 0);
  const totalStorage = workspaces.reduce((acc, w) => acc + w.totalBytes, 0);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
        <p className="text-sm text-neutral-500">Loading your developer workspaces...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen pt-32 px-4 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
          <FolderCode className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Sign In to Access Workspaces
        </h2>
        <p className="text-sm text-neutral-500 mb-6">
          CodeDrop workspaces are private and permanently associated with your Google or VaultDrop account.
        </p>
        <Link
          href="/login?callbackUrl=/workspaces"
          className="btn-primary px-6 py-2.5 text-sm"
        >
          Sign In to VaultDrop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Developer Workspace Vault</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
            My Workspaces
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Manage your live project states, static health reports, snapshots, and cross-device transfers.
          </p>
        </div>

        <Link
          href="/codedrop"
          className="btn-primary px-5 py-2.5 text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Workspace</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-md">
          <span className="text-xs text-neutral-500 block">Total Workspaces</span>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {workspaces.length}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-md">
          <span className="text-xs text-neutral-500 block">Preserved Files</span>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {totalFiles.toLocaleString()}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-md">
          <span className="text-xs text-neutral-500 block">Encrypted Storage</span>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {formatBytes(totalStorage)}
          </p>
        </div>
      </div>

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <FolderCode className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            No workspaces uploaded yet
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
            Upload your first project folder via CodeDrop. Dependency folders like <code className="font-mono">node_modules</code> will be skipped automatically.
          </p>
          <Link
            href="/codedrop"
            className="btn-primary px-5 py-2.5 text-xs"
          >
            <FolderCode className="w-4 h-4" />
            <span>Open CodeDrop</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((ws) => {
            const framework = ws.healthReport?.framework || 'Generic';
            const language = ws.healthReport?.language || 'Files';

            return (
              <div
                key={ws.id}
                className="group flex flex-col justify-between p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 truncate">
                      <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        <FolderCode className="w-5 h-5" />
                      </span>
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {ws.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {framework}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 line-clamp-2 mb-4">
                    {ws.description || `${framework} workspace · ${language}`}
                  </p>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80 text-xs mb-4">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Files</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                        {ws.fileCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Payload</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                        {formatBytes(ws.totalBytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Auto-Skipped</span>
                      <span className="font-semibold text-rose-500 font-mono">
                        {ws.skippedCount.toLocaleString()} files
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Snapshots</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono">
                        {ws.snapshotsCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <Link
                    href={`/workspaces/${ws.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedWorkspaceForSend(ws)}
                      title="Send to Device"
                      className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-cyan-500 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <a
                      href={`/api/workspaces/${ws.id}/download`}
                      download={`${ws.name}.zip`}
                      title="Download as ZIP"
                      className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-teal-500 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(ws.id, ws.name)}
                      title="Delete Workspace"
                      className="p-2 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send to Device Modal */}
      {selectedWorkspaceForSend && (
        <SendToDeviceModal
          isOpen={!!selectedWorkspaceForSend}
          onClose={() => setSelectedWorkspaceForSend(null)}
          itemTitle={`Workspace: ${selectedWorkspaceForSend.name}`}
          itemType="workspace"
          itemPayload={{
            workspaceId: selectedWorkspaceForSend.id,
            projectName: selectedWorkspaceForSend.name,
            fileCount: selectedWorkspaceForSend.fileCount,
            totalBytes: selectedWorkspaceForSend.totalBytes,
          }}
        />
      )}
    </div>
  );
}
