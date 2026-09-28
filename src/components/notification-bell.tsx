'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  FolderCode,
  ArrowRight,
  X,
  Download,
  GitCommit,
  GitBranch,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  workspaceId?: string;
  shareId?: string;
  metadata?: any;
  sender?: {
    id: string;
    name?: string;
    email: string;
    avatarUrl?: string;
  } | null;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications?limit=30');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    if (!session) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [session]);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read-all' }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
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

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (!session) return null;

  const filteredNotifications = notifications.filter((n) =>
    filterTab === 'unread' ? !n.isRead : true
  );

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none border-2 border-white dark:border-neutral-900 shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Center Panel */}
      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full mt-2 sm:w-[420px] max-w-full sm:max-w-md max-h-[82vh] sm:max-h-[540px] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-4 pb-3 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center px-4 pt-2.5 pb-2 border-b border-neutral-200/40 dark:border-neutral-800/40 gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterTab === 'all'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilterTab('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterTab === 'unread'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/40">
            {filteredNotifications.length === 0 ? (
              <div className="py-14 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {filterTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-neutral-400">
                  Activity regarding transfers and GitHub commits will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                // Determine icon & styling based on type
                let icon = <FolderCode className="w-4 h-4 text-sky-500" />;
                let badgeClass = 'bg-sky-500/10 text-sky-500 border border-sky-500/15';

                if (notif.type === 'github_commit_success') {
                  icon = <GitCommit className="w-4 h-4 text-emerald-500" />;
                  badgeClass = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/15';
                } else if (notif.type === 'github_commit_failed') {
                  icon = <AlertTriangle className="w-4 h-4 text-rose-500" />;
                  badgeClass = 'bg-rose-500/10 text-rose-500 border border-rose-500/15';
                } else if (notif.type === 'github_ci_failed') {
                  icon = <AlertCircle className="w-4 h-4 text-amber-500" />;
                  badgeClass = 'bg-amber-500/10 text-amber-500 border border-amber-500/15';
                } else if (notif.type === 'github_ci_passed') {
                  icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                  badgeClass = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/15';
                } else if (notif.type === 'github_repo_imported' || notif.type === 'github_repo_created') {
                  icon = <GitBranch className="w-4 h-4 text-indigo-500" />;
                  badgeClass = 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/15';
                } else if (notif.type === 'workspace_downloaded') {
                  icon = <Download className="w-4 h-4 text-teal-500" />;
                  badgeClass = 'bg-teal-500/10 text-teal-500 border border-teal-500/15';
                }

                return (
                  <div
                    key={notif.id}
                    className={`p-4 transition-colors relative group ${
                      !notif.isRead
                        ? 'bg-sky-500/[0.04] dark:bg-sky-500/[0.06] hover:bg-sky-500/[0.08]'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                    onClick={() => !notif.isRead && markAsRead(notif.id)}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`p-2.5 rounded-xl flex-shrink-0 ${badgeClass}`}>
                        {icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                            )}
                            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                              {notif.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono flex-shrink-0">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <p className="text-[12px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {notif.message}
                        </p>

                        {/* Rich metadata display */}
                        {notif.metadata && (
                          <div className="mt-2 text-[11px] text-neutral-500 bg-neutral-100/70 dark:bg-neutral-800/50 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 space-y-1">
                            {/* Workspace Owner & Shared By */}
                            {notif.metadata.ownerName && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-neutral-400">Owner:</span>
                                <strong className="text-neutral-700 dark:text-neutral-200 font-mono">
                                  {notif.metadata.ownerName}
                                </strong>
                              </div>
                            )}
                            {notif.metadata.senderName && notif.metadata.senderName !== notif.metadata.ownerName && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-neutral-400">Shared by:</span>
                                <span className="text-neutral-600 dark:text-neutral-300 font-mono">
                                  {notif.metadata.senderName}
                                </span>
                              </div>
                            )}
                            {/* File counts / size */}
                            {(notif.metadata.fileCount || notif.metadata.totalSize) && (
                              <div className="flex items-center gap-3 text-[10px] text-neutral-400 font-mono pt-0.5">
                                {notif.metadata.fileCount && (
                                  <span>{notif.metadata.fileCount} files</span>
                                )}
                                {notif.metadata.totalSize && (
                                  <span>{formatBytes(Number(notif.metadata.totalSize))}</span>
                                )}
                              </div>
                            )}
                            {/* Commit metadata */}
                            {notif.metadata.commitSha && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-neutral-400">Commit:</span>
                                <span className="font-mono text-sky-500 font-bold">
                                  {notif.metadata.commitSha.slice(0, 7)}
                                </span>
                              </div>
                            )}
                            {/* CI check metadata */}
                            {notif.metadata.checkName && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-neutral-400">Check:</span>
                                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                                  {notif.metadata.checkName} ({notif.metadata.conclusion})
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions / Deep links */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2.5">
                          {notif.workspaceId && (
                            <Link
                              href={`/workspaces/${notif.workspaceId}`}
                              className="text-[11px] font-bold text-sky-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                              }}
                            >
                              <span>View Workspace</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}

                          {notif.metadata?.commitUrl && (
                            <a
                              href={notif.metadata.commitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:text-sky-500 flex items-center gap-1 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>View Commit</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          {notif.metadata?.htmlUrl && (
                            <a
                              href={notif.metadata.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>View Diagnostics</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          {notif.metadata?.shareCode && (
                            <Link
                              href={`/workspaces/share/${notif.metadata.shareCode}`}
                              className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                              }}
                            >
                              <span>Download Workspace</span>
                              <Download className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-neutral-50/80 dark:bg-neutral-950/50 border-t border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between text-[11px] text-neutral-400 px-4">
            <span className="font-mono text-[10px]">Real-time Event Bridge</span>
            <Link
              href="/transfers"
              onClick={() => setIsOpen(false)}
              className="text-neutral-600 dark:text-neutral-300 hover:text-sky-500 font-semibold transition-colors"
            >
              Transfer History →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
