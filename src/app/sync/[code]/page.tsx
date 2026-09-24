'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import {
  Laptop,
  Smartphone,
  Copy,
  Check,
  Send,
  QrCode,
  Link as LinkIcon,
  ExternalLink,
  PowerOff,
  Radio,
  Clipboard,
  Trash2,
  Share2,
  Users,
  ShieldCheck,
  RefreshCw,
  Camera,
  Download,
  Eye,
  Clock,
  Infinity as InfinityIcon,
  ArrowLeft,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import Pusher from 'pusher-js';

interface SyncItem {
  id: string;
  text: string;
  type: 'text' | 'url' | 'image';
  senderId: string;
  senderName: string;
  timestamp: number;
  isSelf: boolean;
  clipUrl?: string;
}

interface DeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
}

interface SessionData {
  id: string;
  code: string;
  title: string | null;
  type: 'TEMPORARY' | 'PERMANENT';
  status: string;
  ownerId: string | null;
  expiresAt: string | null;
  createdAt: string;
  lastActiveAt: string;
}

function isUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ActiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = ((params?.code as string) || '').toUpperCase().trim();

  // Device identifier
  const [deviceId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('vaultdrop_sync_dev_id');
      if (stored) return stored;
      const id = `dev-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem('vaultdrop_sync_dev_id', id);
      return id;
    }
    return 'dev-init';
  });

  const [deviceName] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent);
      const isWin = /Windows/i.test(navigator.userAgent);
      const platform = isMobile ? 'Mobile Device' : isMac ? 'Mac' : isWin ? 'Windows PC' : 'Desktop';
      return platform;
    }
    return 'Device';
  });

  // State
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stream' | 'devices'>('stream');

  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // References
  const pusherRef = useRef<Pusher | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1-Click Copy Text
  const copyToClipboard = useCallback(async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      toast.success('Copied text to clipboard!', { icon: '📋' });
    } catch {
      toast.error('Failed to copy. Please allow clipboard permissions.');
    }
  }, []);

  // 1-Click Copy Image
  const copyImageToClipboard = useCallback(async (dataUrl: string, id?: string) => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      let pngBlob = blob;
      if (blob.type !== 'image/png') {
        const img = new window.Image();
        img.src = dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/png'));
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),
      ]);

      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      toast.success('Screenshot copied to clipboard!', { icon: '🖼️' });
    } catch (err) {
      console.error('Copy image error:', err);
      toast.error('Could not write image directly. Use Download instead.');
    }
  }, []);

  const downloadImage = (dataUrl: string, filename = 'screenshot.png') => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Screenshot downloaded!');
  };

  // Handle incoming broadcasted clip
  const handleIncomingItem = useCallback(
    async (item: {
      id: string;
      roomId: string;
      text: string;
      type: 'text' | 'url' | 'image';
      senderId: string;
      senderName: string;
      timestamp: number;
      clipUrl?: string;
    }) => {
      const isSelf = item.senderId === deviceId;

      let fullText = item.text;
      // When clipUrl is present, the inline text is a truncated preview — always fetch the full content
      if (item.clipUrl) {
        try {
          const res = await fetch(item.clipUrl);
          if (res.ok) {
            const json = await res.json();
            if (json.data) fullText = json.data;
          }
        } catch {
          // Use whatever text we have as fallback
        }
      }

      const fullItem: SyncItem = {
        ...item,
        text: fullText,
        isSelf,
      };

      setSyncHistory((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        return [fullItem, ...prev];
      });

      if (!isSelf) {
        if (item.type === 'image') {
          try {
            const response = await fetch(fullText);
            const blob = await response.blob();
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            toast.success(`Auto-copied screenshot from ${item.senderName}!`, { icon: '📸' });
          } catch {
            toast.info(`Received screenshot from ${item.senderName}`, {
              action: {
                label: 'Copy Image',
                onClick: () => copyImageToClipboard(fullText),
              },
            });
          }
        } else {
          navigator.clipboard
            ?.writeText(fullText)
            .then(() => {
              toast.success(`Auto-copied from ${item.senderName}!`, {
                description: fullText.length > 50 ? fullText.slice(0, 50) + '...' : fullText,
                icon: '⚡',
              });
            })
            .catch(() => {
              toast.info(`New clip from ${item.senderName}`, {
                description: fullText.length > 40 ? fullText.slice(0, 40) + '...' : fullText,
                action: {
                  label: 'Copy',
                  onClick: () => copyToClipboard(fullText),
                },
              });
            });
        }
      }
    },
    [deviceId, copyToClipboard, copyImageToClipboard]
  );

  // Send device heartbeat
  const sendHeartbeat = useCallback(
    async (isOnline = true) => {
      if (!roomCode) return;
      try {
        await fetch(`/api/sync/session/${roomCode}/device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            deviceName,
            isOnline,
          }),
        });
      } catch {
        // silent fail for heartbeat
      }
    },
    [roomCode, deviceId, deviceName]
  );

  // Load session & 24h history from backend
  const loadSession = useCallback(async () => {
    if (!roomCode) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/sync/session/${roomCode}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid session code. Room does not exist.');
        return;
      }

      const data = await res.json();
      setSession(data.session);

      // Load clips from the last 24h (already sorted newest first)
      if (Array.isArray(data.clips)) {
        setSyncHistory(
          data.clips.map((c: SyncItem) => ({
            ...c,
            isSelf: c.senderId === deviceId,
          }))
        );
      }

      // Load registered devices
      if (Array.isArray(data.devices)) {
        setDevices(data.devices);
      }

      // Initial device heartbeat
      await sendHeartbeat(true);
    } catch {
      setError('Failed to connect to session.');
    } finally {
      setLoading(false);
    }
  }, [roomCode, deviceId, sendHeartbeat]);

  // Connect to real-time transport (Pusher with SSE fallback)
  useEffect(() => {
    if (!roomCode || !session) return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2';

    const hasPusherConfig =
      pusherKey &&
      pusherKey !== 'your_pusher_key' &&
      pusherKey.length > 5;

    if (hasPusherConfig) {
      try {
        const pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          authEndpoint: '/api/sync/auth',
        });
        pusherRef.current = pusher;

        const channelName = `presence-room-${roomCode}`;
        const channel = pusher.subscribe(channelName);

        channel.bind('pusher:subscription_succeeded', () => {
          sendHeartbeat(true);
        });

        channel.bind('pusher:member_added', () => {
          sendHeartbeat(true);
          toast.success('Another device joined the session!', { icon: '📱' });
        });

        channel.bind('pusher:member_removed', () => {
          sendHeartbeat(true);
        });

        channel.bind('clipboard-sync', (data: {
          id: string;
          roomId: string;
          text: string;
          type: 'text' | 'url' | 'image';
          senderId: string;
          senderName: string;
          timestamp: number;
          clipUrl?: string;
        }) => {
          handleIncomingItem(data);
        });
      } catch (err) {
        console.warn('Pusher connection error, falling back to SSE:', err);
      }
    }

    // Always connect SSE fallback stream
    try {
      const sse = new EventSource(`/api/sync/events?roomId=${roomCode}&deviceId=${deviceId}`);
      sseRef.current = sse;

      sse.addEventListener('presence', () => {
        sendHeartbeat(true);
      });

      sse.addEventListener('clipboard-sync', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handleIncomingItem(data);
        } catch {
          // ignore
        }
      });
    } catch (err) {
      console.warn('SSE fallback error:', err);
    }

    // Periodic heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(true);
    }, 30000);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (pusherRef.current) pusherRef.current.disconnect();
      if (sseRef.current) sseRef.current.close();
      sendHeartbeat(false);
    };
  }, [roomCode, session, deviceId, handleIncomingItem, sendHeartbeat]);

  // Initial load
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Broadcast text function
  const broadcastText = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || !roomCode) return;

      setSending(true);
      try {
        const res = await fetch('/api/sync/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomCode,
            text: trimmed,
            senderId: deviceId,
            senderName: deviceName,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to broadcast');
        }

        const data = await res.json();
        if (data.payload) {
          handleIncomingItem(data.payload);
        }
        setTextInput('');
        toast.success('Sent to devices!', { icon: '🚀' });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Broadcast failed');
      } finally {
        setSending(false);
      }
    },
    [roomCode, deviceId, deviceName, handleIncomingItem]
  );

  // Broadcast image screenshot function
  const broadcastImage = useCallback(
    async (dataUrl: string) => {
      if (!dataUrl || !roomCode) return;

      setSending(true);
      const toastId = toast.loading('Broadcasting screenshot to room...');
      try {
        const res = await fetch('/api/sync/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomCode,
            text: dataUrl,
            type: 'image',
            senderId: deviceId,
            senderName: deviceName,
          }),
        });

        toast.dismiss(toastId);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to broadcast screenshot');
        }

        const data = await res.json();
        if (data.payload) {
          handleIncomingItem({ ...data.payload, text: dataUrl });
        }
        toast.success('Screenshot sent to devices! 📸', { icon: '✨' });
      } catch (err) {
        toast.dismiss(toastId);
        toast.error(err instanceof Error ? err.message : 'Failed to send screenshot');
      } finally {
        setSending(false);
      }
    },
    [roomCode, deviceId, deviceName, handleIncomingItem]
  );

  // Global paste listener: captures text, links, and screenshots
  useEffect(() => {
    if (!roomCode || !session) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl !== textareaRef.current;

      if (isInput) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              const reader = new FileReader();
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) broadcastImage(dataUrl);
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
      }

      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && pastedText.trim().length > 0) {
        broadcastText(pastedText);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [roomCode, session, broadcastImage, broadcastText]);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) broadcastImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleLeaveSession = () => {
    sendHeartbeat(false);
    router.push('/sync');
    toast('Left the sync session');
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/sync/${roomCode}`
      : `https://vaultdrop.app/sync/${roomCode}`;

  const onlineDevices = devices.filter((d) => d.isOnline);

  // Loading view
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="skeleton w-48 h-8 mx-auto mb-4" />
        <div className="glass-card max-w-md mx-auto p-8 space-y-4">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[var(--accent)]" />
          <p className="font-semibold text-sm">Connecting to session {roomCode}...</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Retrieving past 24 hours of clipboard history...
          </p>
        </div>
      </div>
    );
  }

  // Error view (Invalid session code)
  if (error || !session) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="glass-card p-8 space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-red-500/10 text-red-500">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold">Invalid Session Code</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {error || 'No active session exists with this code, or it has expired.'}
          </p>
          <Link href="/sync" className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Device Sync
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 animate-fade-in space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Top Header & Session Bar */}
      <div className="glass-card p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sync"
              className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors"
              title="Back to Sync Hub"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg md:text-xl">{session.title || 'Live Sync'}</h1>
                {session.type === 'PERMANENT' ? (
                  <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] gap-1">
                    <InfinityIcon className="w-3 h-3" /> Permanent
                  </span>
                ) : (
                  <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] gap-1">
                    <Clock className="w-3 h-3" /> 24h Temporary
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                <span>Code:</span>
                <span className="font-mono font-bold text-sm text-[var(--accent)] tracking-wider">
                  {session.code}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {onlineDevices.length || 1} online
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQRModal(true)}
              className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              <span>Show QR</span>
            </button>

            <button
              onClick={() => copyToClipboard(shareUrl)}
              className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Copy Link</span>
            </button>

            <button
              onClick={handleLeaveSession}
              className="btn-danger px-3 py-2 text-xs flex items-center gap-1.5"
            >
              <PowerOff className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-primary)] pt-1">
          <button
            onClick={() => setActiveTab('stream')}
            className={`pb-2.5 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'stream'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Radio className="w-4 h-4" />
            Clipboard Stream
            <span className="px-1.5 py-0.2 rounded-full bg-[var(--bg-secondary)] text-xs font-normal">
              {syncHistory.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`pb-2.5 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'devices'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-4 h-4" />
            Connected Devices
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-normal">
              {onlineDevices.length || 1}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'stream' ? (
        /* Clipboard Stream Tab */
        <div className="space-y-6">
          {/* Global Paste Banner */}
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs sm:text-sm flex items-center gap-2.5 text-emerald-400">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>
              <strong>Global Paste Active:</strong> Press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[11px]">Ctrl</kbd>+
              <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[11px]">V</kbd> anywhere
              to broadcast text, links, or <strong>screenshots</strong>. Clips are safely saved for 24 hours!
            </span>
          </div>

          {/* Quick Input Box */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Clipboard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                Send to Room
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs hover:underline flex items-center gap-1 text-[var(--accent)] font-medium"
                >
                  <Camera className="w-3.5 h-3.5" /> Send Screenshot
                </button>
                {textInput && (
                  <button
                    type="button"
                    onClick={() => setTextInput('')}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  broadcastText(textInput);
                }
              }}
              placeholder="Type, paste text, link, or paste a screenshot (Ctrl+V) here... (Ctrl+Enter to send)"
              rows={3}
              className="input font-mono text-sm resize-y"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {textInput.length} character{textInput.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => broadcastText(textInput)}
                disabled={sending || !textInput.trim()}
                className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
              >
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to Devices
              </button>
            </div>
          </div>

          {/* Stream Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-[var(--accent)]" />
                Synced Clipboard Stream (Past 24h)
              </h2>
              {syncHistory.length > 0 && (
                <button
                  onClick={() => setSyncHistory([])}
                  className="text-xs flex items-center gap-1 hover:text-red-400 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear View
                </button>
              )}
            </div>

            {syncHistory.length === 0 ? (
              <div className="glass-card p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-[var(--bg-secondary)]">
                  <Clipboard className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <p className="font-semibold text-sm">No items in the stream</p>
                <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Press <kbd className="font-mono bg-[var(--bg-secondary)] px-1 rounded border border-[var(--border-secondary)]">Ctrl+V</kbd> anywhere to paste text, links, or screenshots. It will stay preserved here for 24 hours.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {syncHistory.map((item) => {
                  const isCopied = copiedId === item.id;
                  const itemIsUrl = item.type === 'url' || isUrl(item.text);
                  const isScreenshot = item.type === 'image' || item.text.startsWith('data:image/');

                  return (
                    <div
                      key={item.id}
                      className="glass-card p-4 transition-all hover:border-[var(--accent)] space-y-3"
                    >
                      {/* Item header */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge ${
                              item.isSelf ? 'bg-zinc-800 text-zinc-300' : 'badge-active'
                            }`}
                          >
                            {item.isSelf ? <Laptop className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                            {item.isSelf ? 'This Device' : item.senderName}
                          </span>
                          {isScreenshot ? (
                            <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Camera className="w-3 h-3" />
                              Screenshot
                            </span>
                          ) : itemIsUrl ? (
                            <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <LinkIcon className="w-3 h-3" />
                              Link
                            </span>
                          ) : null}
                        </div>
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Content preview */}
                      {isScreenshot ? (
                        <div className="relative group/img overflow-hidden rounded-xl border border-[var(--border-secondary)] bg-black/20 flex items-center justify-center p-2">
                          <img
                            src={item.text}
                            alt="Synced screenshot"
                            className="max-h-72 max-w-full rounded-lg object-contain cursor-zoom-in transition-transform hover:scale-[1.01]"
                            onClick={() => setPreviewImage(item.text)}
                          />
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] font-mono text-xs md:text-sm break-all select-all whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {item.text}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {isScreenshot ? 'Image / PNG' : `${item.text.length} chars`}
                        </span>
                        <div className="flex items-center gap-2">
                          {isScreenshot ? (
                            <>
                              <button
                                onClick={() => setPreviewImage(item.text)}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                onClick={() => downloadImage(item.text, `screenshot-${item.id}.png`)}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Save
                              </button>
                              <button
                                onClick={() => copyImageToClipboard(item.text, item.id)}
                                className="btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-white" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy Image
                                  </>
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              {itemIsUrl && (
                                <a
                                  href={item.text.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Open
                                </a>
                              )}
                              <button
                                onClick={() => copyToClipboard(item.text, item.id)}
                                className="btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-white" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Connected Devices Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              Paired Devices in Session
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Auto-refreshes with live presence
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {devices.length === 0 ? (
              <div className="glass-card p-6 text-center col-span-2">
                <Monitor className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)]" />
                <p className="text-sm font-semibold">This Device</p>
                <p className="text-xs text-emerald-400 mt-1">● Online & Ready</p>
              </div>
            ) : (
              devices.map((dev) => {
                const isCurrent = dev.deviceId === deviceId;
                const isMobile = /Phone|iPad|Android/i.test(dev.deviceName);

                return (
                  <div key={dev.id} className="glass-card p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-secondary)]">
                        {isMobile ? (
                          <Smartphone className="w-5 h-5 text-[var(--accent)]" />
                        ) : (
                          <Laptop className="w-5 h-5 text-[var(--accent)]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{dev.deviceName}</p>
                          {isCurrent && (
                            <span className="badge bg-zinc-800 text-zinc-300 text-[10px]">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          Joined {new Date(dev.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {dev.isOnline ? (
                        <span className="badge badge-active text-xs flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="badge text-xs flex items-center gap-1 bg-zinc-800 text-zinc-400">
                          <span className="w-2 h-2 rounded-full bg-zinc-500" />
                          Offline
                        </span>
                      )}
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {dev.isOnline ? 'Active now' : `Last seen ${new Date(dev.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Invite Device Box */}
          <div className="glass-card p-5 border-dashed flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Pair another phone, tablet, or PC</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Point any device camera to this QR code or enter code{' '}
                <strong className="font-mono text-[var(--accent)]">{roomCode}</strong>
              </p>
            </div>
            <button
              onClick={() => setShowQRModal(true)}
              className="btn-primary text-xs px-4 py-2.5 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              Display Pairing QR
            </button>
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Screenshot full view"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black/90 text-white flex items-center justify-center hover:bg-black font-bold border border-white/20"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="glass-card max-w-sm w-full p-6 text-center space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[var(--accent)]" />
                Scan to Join Room
              </h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-lg font-bold text-zinc-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-lg mx-auto">
              <QRCodeSVG value={shareUrl} size={200} level="M" includeMargin={false} />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-mono tracking-widest text-[var(--accent)] font-bold text-lg">
                {roomCode}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Point your phone camera to pair your clipboard instantly.
              </p>
            </div>

            <button
              onClick={() => {
                copyToClipboard(shareUrl);
                setShowQRModal(false);
              }}
              className="btn-secondary w-full py-2.5 text-xs flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy Pairing Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
