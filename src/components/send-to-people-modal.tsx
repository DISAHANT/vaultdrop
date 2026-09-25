'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Mail,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Trash2,
  Loader2,
  FolderCode,
  Search,
  Check,
  Clock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceInfo {
  id: string;
  name: string;
  fileCount: number;
  totalBytes: number;
  shareCode: string;
}

interface RegisteredUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface SharedRecipient {
  id: string;
  recipientEmail: string;
  permission: string;
  status?: string;
  message?: string | null;
  createdAt: string;
  recipient?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

interface SendToPeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceInfo | null;
  initialEmail?: string;
}

export default function SendToPeopleModal({
  isOpen,
  onClose,
  workspace,
  initialEmail = '',
}: SendToPeopleModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [manualEmail, setManualEmail] = useState(initialEmail);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<'download' | 'view'>('download');
  const [message, setMessage] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<RegisteredUser[]>([]);
  const [activeShares, setActiveShares] = useState<SharedRecipient[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);

  useEffect(() => {
    if (initialEmail && initialEmail.includes('@')) {
      setSelectedEmails((prev) => new Set([...prev, initialEmail.trim().toLowerCase()]));
      setManualEmail(initialEmail);
    }
  }, [initialEmail]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getShareUrl = () => {
    if (!workspace?.shareCode) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/workspaces/share/${workspace.shareCode}`;
  };

  // Fetch registered users and active workspace shares
  useEffect(() => {
    if (!isOpen || !workspace?.id) return;

    setLoadingShares(true);
    fetch(`/api/workspaces/${workspace.id}/shares`)
      .then((res) => (res.ok ? res.json() : { shares: [] }))
      .then((data) => setActiveShares(data.shares || []))
      .catch(() => {})
      .finally(() => setLoadingShares(false));

    setLoadingUsers(true);
    fetch('/api/users/lookup')
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setSuggestedUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [isOpen, workspace?.id]);

  // Filtered users based on search
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suggestedUsers;
    return suggestedUsers.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q)
    );
  }, [suggestedUsers, searchQuery]);

  const toggleSelectUser = (email: string) => {
    const normalized = email.toLowerCase().trim();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  };

  const handleAddManualEmail = () => {
    const email = manualEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid Gmail / email address.');
      return;
    }
    setSelectedEmails((prev) => new Set([...prev, email]));
    setManualEmail('');
    toast.success(`Added ${email} to recipients.`);
  };

  const handleSendFile = async () => {
    if (!workspace) return;
    const recipientsList = Array.from(selectedEmails);
    if (recipientsList.length === 0) {
      toast.error('Please select at least one person or enter a Gmail address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmails: recipientsList,
          permission,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to share workspace.');
      }

      toast.success(
        `File sent successfully to ${recipientsList.length} ${
          recipientsList.length === 1 ? 'person' : 'people'
        }! 🚀`
      );

      if (data.shares && Array.isArray(data.shares)) {
        setActiveShares((prev) => {
          const newIds = new Set(data.shares.map((s: any) => s.id));
          return [...data.shares, ...prev.filter((s) => !newIds.has(s.id))];
        });
      }

      setSelectedEmails(new Set());
      setMessage('');
      setSearchQuery('');
    } catch (err: any) {
      toast.error(err.message || 'Error sending file to recipients.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url);
    toast.success('Workspace secure link copied to clipboard!');
  };

  const handleRevokeShare = async (shareId: string, email: string) => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/shares?shareId=${shareId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setActiveShares((prev) => prev.filter((s) => s.id !== shareId));
        toast.success(`Revoked access for ${email}`);
      } else {
        toast.error('Failed to revoke access');
      }
    } catch {
      toast.error('Network error revoking access');
    }
  };

  if (!isOpen || !workspace) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Send to People
              </h2>
              <p className="text-xs text-neutral-500">
                Select registered people in our application or enter a Gmail address
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Summary Chip */}
        <div className="my-3 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2.5 truncate mr-2">
            <FolderCode className="w-4 h-4 text-cyan-500 flex-shrink-0" />
            <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {workspace.name}
            </span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-500 font-mono">
              {workspace.fileCount} files ({formatBytes(workspace.totalBytes)})
            </span>
          </div>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors flex-shrink-0 font-medium text-[11px]"
          >
            <Copy className="w-3 h-3" />
            <span>Copy Link</span>
          </button>
        </div>

        {/* Scrollable Main Area */}
        <div className="overflow-y-auto pr-1 space-y-4 flex-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* People Selection List with Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                People in application
              </span>
              {filteredUsers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedEmails.size === filteredUsers.length) {
                      setSelectedEmails(new Set());
                    } else {
                      setSelectedEmails(new Set(filteredUsers.map((u) => u.email.toLowerCase())));
                    }
                  }}
                  className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  {selectedEmails.size === filteredUsers.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {loadingUsers ? (
                <div className="py-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                  <span>Loading people...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                  {searchQuery ? 'No matching people found.' : 'No other users registered yet.'}
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isChecked = selectedEmails.has(u.email.toLowerCase());
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSelectUser(u.email)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-neutral-900 dark:text-white'
                          : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                            isChecked
                              ? 'bg-cyan-500 border-cyan-500 text-white'
                              : 'border-neutral-400 dark:border-neutral-600 bg-white dark:bg-neutral-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Avatar / Initial */}
                        <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>

                        {/* Person Details */}
                        <div className="truncate">
                          <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {u.name || u.email.split('@')[0]}
                          </p>
                          <p className="text-[11px] text-neutral-500 font-mono truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                        In App
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Add custom / external Gmail address */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1.5">
              Or invite by Gmail / Email
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="email"
                  placeholder="colleague@gmail.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddManualEmail();
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddManualEmail}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors whitespace-nowrap"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Selected count banner */}
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Selected: <strong className="text-cyan-600 dark:text-cyan-400">{selectedEmails.size} {selectedEmails.size === 1 ? 'person' : 'people'}</strong>
            </span>
            {selectedEmails.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedEmails(new Set())}
                className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>

          {/* Optional Message Field */}
          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
              Message (optional):
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Here is the latest project code we discussed."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          {/* Cancel and Send File Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendFile}
              disabled={submitting || selectedEmails.size === 0}
              className="px-6 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Send File ({selectedEmails.size})</span>
            </button>
          </div>

          {/* Section 8: Sharing History */}
          {activeShares.length > 0 && (
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-2">
                Shared with
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {activeShares.map((s) => {
                  const displayName = s.recipient?.name || s.recipientEmail.split('@')[0];
                  const displayStatus = s.status || 'Sent';

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span className="text-neutral-400">•</span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {displayName}
                        </span>
                        <span className="text-neutral-400">—</span>
                        <span className="text-neutral-500 font-mono text-[11px] truncate">
                          {s.recipientEmail}
                        </span>
                        <span className="text-neutral-400">—</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 capitalize">
                          {displayStatus}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeShare(s.id, s.recipientEmail)}
                        title="Revoke access"
                        className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
