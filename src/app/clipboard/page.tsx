'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Clipboard,
  ClipboardPaste,
  Copy,
  Send,
  Trash2,
  Check,
  Code2,
  Globe,
  FileText,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Plus,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  queryClipboardPermission,
  readSystemClipboard,
  writeSystemClipboard,
  detectContentType,
  ClipboardPermissionState,
  ClipboardContentType,
} from '@/lib/clipboard';
import SendToDeviceModal from '@/components/send-to-device-modal';
import { getDeviceId } from '@/lib/device';
import { toast } from 'sonner';

interface ClipboardItem {
  id: string;
  content: string;
  type: ClipboardContentType;
  metadata?: any;
  deviceId?: string;
  createdAt: string;
}

export default function ClipboardPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<ClipboardPermissionState>('prompt');

  // New item manual composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [composedText, setComposedText] = useState('');

  // Copied feedback map
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Send to device modal
  const [selectedItemForSend, setSelectedItemForSend] = useState<ClipboardItem | null>(null);

  // Check browser permission status
  useEffect(() => {
    queryClipboardPermission().then(setPermissionState);
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clipboard');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Fetch clipboard items error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchItems();
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [session, status]);

  // Paste from OS Clipboard into VaultDrop
  const handlePasteFromClipboard = async () => {
    try {
      const readResult = await readSystemClipboard();
      if (!readResult || !readResult.content.trim()) {
        toast.info('Clipboard is currently empty.');
        return;
      }

      await saveClipboardItem(readResult.content, readResult.type);
      queryClipboardPermission().then(setPermissionState);
      toast.success('Pasted from clipboard into VaultDrop!');
    } catch (err: any) {
      toast.error(err.message || 'Could not access clipboard.');
      queryClipboardPermission().then(setPermissionState);
    }
  };

  const saveClipboardItem = async (content: string, type: ClipboardContentType) => {
    const deviceId = getDeviceId();
    const res = await fetch('/api/clipboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type, deviceId }),
    });

    if (res.ok) {
      const data = await res.json();
      setItems((prev) => [data.item, ...prev]);
      setComposerOpen(false);
      setComposedText('');
    } else {
      toast.error('Failed to save clipboard item.');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composedText.trim()) return;
    const type = detectContentType(composedText);
    await saveClipboardItem(composedText, type);
    toast.success('Added to cross-device clipboard!');
  };

  const handleCopyToSystem = async (id: string, text: string) => {
    const success = await writeSystemClipboard(text);
    if (success) {
      setCopiedId(id);
      toast.success('Copied to system clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast.error('Failed to write to clipboard.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/clipboard?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast.success('Item removed.');
      }
    } catch {
      toast.error('Failed to delete item.');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all clipboard history?')) return;
    try {
      const res = await fetch('/api/clipboard', { method: 'DELETE' });
      if (res.ok) {
        setItems([]);
        toast.success('Clipboard history cleared.');
      }
    } catch {
      toast.error('Failed to clear clipboard.');
    }
  };

  const getTypeIcon = (type: ClipboardContentType) => {
    switch (type) {
      case 'url':
        return <Globe className="w-4 h-4 text-cyan-500" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-indigo-500" />;
      default:
        return <FileText className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-2">
            <Clipboard className="w-3.5 h-3.5" />
            <span>Cross-Device Clipboard Sync</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
            Clipboard Hub
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Bridge text, URLs, and code snippets across your connected phones, laptops, and desktops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePasteFromClipboard}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/25"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Paste from OS</span>
          </button>
          <button
            onClick={() => setComposerOpen(!composerOpen)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Realistic Browser Permission Notice */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          {permissionState === 'granted' ? (
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          ) : permissionState === 'denied' ? (
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
              <HelpCircle className="w-4 h-4" />
            </div>
          )}
          <div>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              Browser Clipboard Access: <strong className="capitalize">{permissionState}</strong>
            </span>
            <p className="text-neutral-500 text-[11px]">
              Modern browser security requires direct user interaction to read OS clipboard. Native desktop apps provide deeper background sync.
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-neutral-400 hover:text-rose-500 text-xs transition-colors self-end sm:self-center"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Compose Form */}
      {composerOpen && (
        <form
          onSubmit={handleManualSubmit}
          className="p-6 rounded-3xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-cyan-500/30 shadow-xl space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-cyan-500" />
              <span>New Clipboard Item</span>
            </h3>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              ✕
            </button>
          </div>

          <textarea
            rows={4}
            placeholder="Type or paste code, URL, or notes to sync with your other devices..."
            value={composedText}
            onChange={(e) => setComposedText(e.target.value)}
            className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-cyan-500 resize-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">
              Detected Type: <strong className="capitalize">{detectContentType(composedText)}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-500 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!composedText.trim()}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-cyan-600/20 transition-all"
              >
                Save & Broadcast
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Items List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-6 h-6 text-cyan-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-neutral-500">Loading clipboard history...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40">
            <ClipboardPaste className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              No clipboard items yet
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
              Click &quot;Paste from OS&quot; to import what is currently in your system clipboard, or compose a new item manually.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg hover:shadow-xl transition-all space-y-3"
            >
              <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <div className="flex items-center gap-2">
                  {getTypeIcon(item.type)}
                  <span className="capitalize font-semibold text-neutral-700 dark:text-neutral-300">
                    {item.type}
                  </span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-neutral-400 text-[11px]">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyToSystem(item.id, item.content)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedItemForSend(item)}
                    title="Send to Device"
                    className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-cyan-500 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    title="Delete"
                    className="p-1.5 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content Preview */}
              <div className="max-h-48 overflow-y-auto">
                {item.type === 'url' ? (
                  <a
                    href={item.content}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-600 dark:text-cyan-400 hover:underline break-all text-sm font-mono flex items-center gap-1.5"
                  >
                    <span>{item.content}</span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                ) : item.type === 'code' ? (
                  <pre className="p-3 rounded-xl bg-neutral-950 text-cyan-300 font-mono text-xs overflow-x-auto">
                    <code>{item.content}</code>
                  </pre>
                ) : (
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words font-sans">
                    {item.content}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Send to Device Modal */}
      {selectedItemForSend && (
        <SendToDeviceModal
          isOpen={!!selectedItemForSend}
          onClose={() => setSelectedItemForSend(null)}
          itemTitle={`Clipboard: ${selectedItemForSend.type.toUpperCase()}`}
          itemType="clipboard"
          itemPayload={{
            type: selectedItemForSend.type,
            content: selectedItemForSend.content,
          }}
        />
      )}
    </div>
  );
}
