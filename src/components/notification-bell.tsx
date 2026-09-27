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
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications?limit=20');
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

  if (!session) return null;

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
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none border-2 border-white dark:border-neutral-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Notifications
            </h3>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-sky-500 hover:text-sky-400 font-semibold transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer ${
                    !notif.isRead ? 'bg-sky-500/[0.03] dark:bg-sky-500/[0.05]' : ''
                  }`}
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      notif.type === 'workspace_shared'
                        ? 'bg-sky-500/10 text-sky-500'
                        : notif.type === 'workspace_downloaded'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                    }`}>
                      {notif.type === 'workspace_shared' ? (
                        <FolderCode className="w-4 h-4" />
                      ) : notif.type === 'workspace_downloaded' ? (
                        <Download className="w-4 h-4" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {notif.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                        {notif.workspaceId && (
                          <Link
                            href={`/workspaces/${notif.workspaceId}`}
                            className="text-[10px] text-sky-500 hover:text-sky-400 font-semibold flex items-center gap-0.5 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>View</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        )}
                        {notif.metadata?.shareCode && (
                          <Link
                            href={`/workspaces/share/${notif.metadata.shareCode}`}
                            className="text-[10px] text-sky-500 hover:text-sky-400 font-semibold flex items-center gap-0.5 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Download</span>
                            <Download className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
