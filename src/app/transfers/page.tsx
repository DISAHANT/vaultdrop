'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Send,
  Download,
  Inbox,
  FolderCode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  Shield,
  Package,
  FileCheck,
  Copy,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface UploadItem {
  id: string;
  name: string;
  shareCode: string;
  fileCount: number;
  totalBytes: number;
  workspaceStatus: string;
  packageChecksum: string | null;
  sharesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SentItem {
  id: string;
  workspaceId: string;
  workspaceName: string;
  fileCount: number;
  totalBytes: number;
  workspaceStatus: string;
  recipientEmail: string;
  recipientName: string | null;
  status: string;
  downloadCount: number;
  downloadedAt: string | null;
  revokedAt: string | null;
  permission: string;
  message: string | null;
  createdAt: string;
  ownerName: string;
}

interface ReceivedItem {
  id: string;
  workspaceId: string;
  workspaceName: string;
  fileCount: number;
  totalBytes: number;
  workspaceStatus: string;
  senderEmail: string;
  senderName: string | null;
  senderAvatar: string | null;
  status: string;
  downloadCount: number;
  downloadedAt: string | null;
  permission: string;
  message: string | null;
  createdAt: string;
  ownerName: string;
}

type TabType = 'uploads' | 'sent' | 'received';

export default function TransfersPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('uploads');
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [sent, setSent] = useState<SentItem[]>([]);
  const [received, setReceived] = useState<ReceivedItem[]>([]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login?callbackUrl=/transfers');
    }
  }, [authStatus, router]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/transfers');
      if (res.ok) {
        const data = await res.json();
        setUploads(data.uploads || []);
        setSent(data.sent || []);
        setReceived(data.received || []);
      }
    } catch {
      toast.error('Failed to load transfer history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchTransfers();
  }, [session]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" /> READY
          </span>
        );
      case 'CREATING':
      case 'VERIFYING':
      case 'PACKAGING':
      case 'UPLOADING_PACKAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Loader2 className="w-2.5 h-2.5 animate-spin" /> {status}
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-2.5 h-2.5" /> FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            <Clock className="w-2.5 h-2.5" /> {status}
          </span>
        );
    }
  };

  const getShareStatusBadge = (status: string) => {
    switch (status) {
      case 'downloaded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Download className="w-2.5 h-2.5" /> Downloaded
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Send className="w-2.5 h-2.5" /> Sent
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-2.5 h-2.5" /> Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            <Clock className="w-2.5 h-2.5" /> {status}
          </span>
        );
    }
  };

  const handleCopyShareCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Share code copied!');
  };

  const handleDownload = async (workspaceId: string, shareCode: string) => {
    try {
      window.open(`/api/workspaces/${workspaceId}/download?code=${shareCode}`, '_blank');
    } catch {
      toast.error('Download failed');
    }
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'uploads', label: 'My Uploads', icon: <Upload className="w-4 h-4" />, count: uploads.length },
    { key: 'sent', label: 'Sent', icon: <Send className="w-4 h-4" />, count: sent.length },
    { key: 'received', label: 'Received', icon: <Inbox className="w-4 h-4" />, count: received.length },
  ];

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-3">
            <Package className="w-3.5 h-3.5" />
            <span>Transfer Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-50">
            Workspace Transfers
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Upload, share, and download history for all your workspaces.</p>
        </div>
        <button
          onClick={fetchTransfers}
          disabled={loading}
          className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                activeTab === tab.key
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Uploads Tab */}
          {activeTab === 'uploads' && (
            uploads.length === 0 ? (
              <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <Upload className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-neutral-400 font-medium">No workspaces uploaded yet</p>
                <Link href="/codedrop" className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold mt-2 inline-flex items-center gap-1">
                  Upload your first workspace <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              uploads.map((upload) => (
                <div key={upload.id} className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <FolderCode className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/workspaces/${upload.id}`}
                          className="text-sm font-bold text-neutral-900 dark:text-neutral-100 hover:text-indigo-500 transition-colors truncate block"
                        >
                          {upload.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                          <span>{upload.fileCount} files</span>
                          <span>·</span>
                          <span>{formatBytes(upload.totalBytes)}</span>
                          <span>·</span>
                          <span>{formatDate(upload.createdAt)}</span>
                          {upload.sharesCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-sky-500">{upload.sharesCount} share{upload.sharesCount > 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                      {getStatusBadge(upload.workspaceStatus)}
                      {upload.packageChecksum && (
                        <span className="text-[10px] text-emerald-500 font-mono" title={`Checksum: ${upload.packageChecksum}`}>
                          <Shield className="w-3 h-3 inline" /> verified
                        </span>
                      )}
                      <button
                        onClick={() => handleCopyShareCode(upload.shareCode)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                        title={`Share code: ${upload.shareCode}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {/* Sent Tab */}
          {activeTab === 'sent' && (
            sent.length === 0 ? (
              <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <Send className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-neutral-400 font-medium">You haven&apos;t sent any workspaces yet</p>
              </div>
            ) : (
              sent.map((item) => (
                <div key={item.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                        <Send className="w-5 h-5 text-sky-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {item.workspaceName}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                          <span>To: <span className="text-neutral-600 dark:text-neutral-300">{item.recipientName || item.recipientEmail}</span></span>
                          <span>·</span>
                          <span>{item.fileCount} files</span>
                          <span>·</span>
                          <span>{formatBytes(item.totalBytes)}</span>
                          <span>·</span>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                      {getShareStatusBadge(item.status)}
                      {item.downloadCount > 0 && (
                        <span className="text-[10px] text-emerald-500 font-mono">
                          <Download className="w-2.5 h-2.5 inline" /> {item.downloadCount}×
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {/* Received Tab */}
          {activeTab === 'received' && (
            received.length === 0 ? (
              <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <Inbox className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-neutral-400 font-medium">No workspaces received yet</p>
              </div>
            ) : (
              received.map((item) => (
                <div key={item.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                        <Inbox className="w-5 h-5 text-teal-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {item.workspaceName}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                          <span>From: <span className="text-neutral-600 dark:text-neutral-300">{item.senderName || item.senderEmail}</span></span>
                          <span>·</span>
                          <span>Owner: {item.ownerName}</span>
                          <span>·</span>
                          <span>{item.fileCount} files</span>
                          <span>·</span>
                          <span>{formatBytes(item.totalBytes)}</span>
                          <span>·</span>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                        {item.message && (
                          <p className="text-[11px] text-neutral-500 italic mt-1 truncate max-w-md">&ldquo;{item.message}&rdquo;</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                      {getShareStatusBadge(item.status)}
                      {item.workspaceStatus === 'READY' && item.permission === 'download' && (
                        <button
                          onClick={() => handleDownload(item.workspaceId, '')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
