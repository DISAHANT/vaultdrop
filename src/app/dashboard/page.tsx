'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FolderCode,
  Laptop,
  Clipboard,
  Radio,
  Upload,
  Download,
  Send,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Trash2,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Plus,
  Shield,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/config';
import SendToDeviceModal from '@/components/send-to-device-modal';

interface DashboardStats {
  totalShares: number;
  activeShares: number;
  expiredShares: number;
  totalDownloads: number;
  totalFiles: number;
  totalStoredSize: string;
  workspacesCount: number;
  workspaceFilesCount: number;
  workspaceBytes: number;
  totalDevices: number;
  onlineDevices: number;
  clipboardCount: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [clipboardItems, setClipboardItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Send to Device Modal State
  const [sendModalOpen, setSendModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, sharesRes, workspacesRes, devicesRes, clipboardRes] = await Promise.all([
        fetch('/api/user/stats'),
        fetch('/api/user/shares?limit=6'),
        fetch('/api/workspaces'),
        fetch('/api/devices'),
        fetch('/api/clipboard'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (sharesRes.ok) {
        const data = await sharesRes.json();
        setShares(data.shares || []);
      }
      if (workspacesRes.ok) {
        const data = await workspacesRes.json();
        setWorkspaces(data.workspaces || []);
      }
      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setDevices(data.devices || []);
      }
      if (clipboardRes.ok) {
        const data = await clipboardRes.json();
        setClipboardItems(data.items || []);
      }
    } catch {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAllData();
    }
  }, [status, fetchAllData]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Share code copied!');
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/receive/${code}`);
    toast.success('Link copied to clipboard!');
  };

  const handleDeleteShare = async (code: string) => {
    if (!confirm('Delete this share? This cannot be undone.')) return;
    try {
      await fetch(`/api/shares/${code}`, { method: 'DELETE' });
      toast.success('Share deleted');
      fetchAllData();
    } catch {
      toast.error('Failed to delete share');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
        <p className="text-sm text-neutral-500">Loading your developer workspace dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-10">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-neutral-100">
            Control Center
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Personal transfer bridge across your files, live clipboard, and CodeDrop projects.
          </p>
        </div>

        {/* Quick Actions Row */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/codedrop"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all"
          >
            <FolderCode className="w-4 h-4" />
            <span>Upload Workspace</span>
          </Link>

          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-bold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </Link>

          <button
            onClick={() => setSendModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 shadow-sm transition-all"
          >
            <Send className="w-4 h-4 text-teal-500" />
            <span>Send to Device</span>
          </button>

          <Link
            href="/sync"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs hover:bg-emerald-500/20 shadow-sm transition-all"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Live Sync</span>
          </Link>

          <Link
            href="/clipboard"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:bg-indigo-500/20 shadow-sm transition-all"
          >
            <Clipboard className="w-4 h-4" />
            <span>Clipboard</span>
          </Link>
        </div>
      </div>

      {/* 4 Primary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Storage Used */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-500">Storage In Use</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {formatBytes(parseInt(stats?.totalStoredSize || '0'))}
          </p>
          <span className="text-[11px] text-neutral-400">Encrypted Filebase S3 Bucket</span>
        </div>

        {/* CodeDrop Workspaces */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-500">Workspaces</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderCode className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {stats?.workspacesCount || 0}
          </p>
          <span className="text-[11px] text-neutral-400">
            {stats?.workspaceFilesCount || 0} preserved files
          </span>
        </div>

        {/* Connected Devices */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-500">Linked Devices</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
              {stats?.totalDevices || 0}
            </p>
            <span className="text-xs font-semibold text-emerald-500">
              ● {stats?.onlineDevices || 0} online
            </span>
          </div>
          <span className="text-[11px] text-neutral-400">Persistent device identities</span>
        </div>

        {/* Clipboard Snippets */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-500">Clipboard History</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clipboard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {stats?.clipboardCount || 0}
          </p>
          <span className="text-[11px] text-neutral-400">Synced text, code & URLs</span>
        </div>
      </div>

      {/* Grid: Recent Workspaces & Connected Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Workspaces Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <FolderCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Recent Workspaces
                </h3>
                <p className="text-xs text-neutral-500">Point-in-time developer project folders</p>
              </div>
            </div>
            <Link
              href="/workspaces"
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {workspaces.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <p className="text-xs text-neutral-500 mb-3">No developer workspaces uploaded yet.</p>
              <Link
                href="/codedrop"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs hover:bg-cyan-500"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Workspace</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {workspaces.slice(0, 4).map((ws) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80 text-xs"
                >
                  <div className="flex items-center gap-3 truncate">
                    <FolderCode className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                    <div className="truncate">
                      <Link
                        href={`/workspaces/${ws.id}`}
                        className="font-bold text-neutral-900 dark:text-neutral-100 hover:underline truncate block"
                      >
                        {ws.name}
                      </Link>
                      <span className="text-[11px] text-neutral-400">
                        {ws.fileCount} files · {formatBytes(ws.totalBytes)} · {ws.healthReport?.framework || 'Project'}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/workspaces/${ws.id}`}
                    className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected Devices Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Registered Devices
                </h3>
                <p className="text-xs text-neutral-500">Live presence and direct transfer targets</p>
              </div>
            </div>
            <Link
              href="/devices"
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {devices.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <p className="text-xs text-neutral-500 mb-3">No linked devices registered.</p>
              <Link
                href="/devices"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-500"
              >
                <span>Register This Device</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        d.status === 'online'
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse'
                          : d.status === 'idle'
                          ? 'bg-amber-500'
                          : 'bg-neutral-400'
                      }`}
                    />
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                        {d.deviceName}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {d.deviceType} · {d.browser} · {d.operatingSystem}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Shared Files / S3 Objects & Clipboard Snippets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Shares */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Shared File Vaults
                </h3>
                <p className="text-xs text-neutral-500">Expiring files with custom codes</p>
              </div>
            </div>
            <Link
              href="/upload"
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>+ Share File</span>
            </Link>
          </div>

          {shares.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No active file shares.</p>
          ) : (
            <div className="space-y-3">
              {shares.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {s.shareCode}
                      </span>
                      <span className="text-neutral-800 dark:text-neutral-200 font-semibold truncate max-w-[140px]">
                        {s.title || 'Untitled Share'}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-400">
                      {s.totalFiles} files · {s.totalSize} · {s.downloadCount} downloads
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyCode(s.shareCode)}
                      title="Copy Code"
                      className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => copyLink(s.shareCode)}
                      title="Copy Link"
                      className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteShare(s.shareCode)}
                      title="Delete"
                      className="p-1.5 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Clipboard Items */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Clipboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Recent Clipboard Snippets
                </h3>
                <p className="text-xs text-neutral-500">Live synced across devices</p>
              </div>
            </div>
            <Link
              href="/clipboard"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {clipboardItems.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No clipboard items synced yet.</p>
          ) : (
            <div className="space-y-3">
              {clipboardItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="capitalize font-semibold text-neutral-600 dark:text-neutral-300">
                      {item.type}
                    </span>
                    <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-neutral-800 dark:text-neutral-200 font-mono truncate">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global Send to Device Modal */}
      <SendToDeviceModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        itemTitle="Quick Device Transfer"
        itemType="file"
        itemPayload={{ text: 'Quick transfer ping from dashboard' }}
      />
    </div>
  );
}
