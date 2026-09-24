'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Sparkles,
  Clipboard,
  Trash2,
  Share2,
  Users,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Download,
  Eye,
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

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

function isUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function LiveSyncContent() {
  const searchParams = useSearchParams();
  const urlRoom = searchParams.get('room');

  // Device & session identifiers
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
      return isMobile ? 'Mobile Device' : 'Desktop Browser';
    }
    return 'Device';
  });

  // State
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [showQRModal, setShowQRModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // References for cleanup
  const pusherRef = useRef<Pusher | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1-Click Copy text helper
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

  // 1-Click Copy Image / Screenshot helper
  const copyImageToClipboard = useCallback(async (dataUrl: string, id?: string) => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Convert to png if necessary for clipboard API compatibility
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
      toast.error('Could not write image to clipboard. Try downloading it instead.');
    }
  }, []);

  // Download image helper
  const downloadImage = (dataUrl: string, filename = 'screenshot.png') => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Screenshot downloaded!');
  };

  // Handle incoming broadcasted item
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

      // If text is empty but clipUrl is provided (large payload like screenshot), fetch it
      let fullText = item.text;
      if (item.clipUrl && (!fullText || fullText.length < 50)) {
        try {
          const res = await fetch(item.clipUrl);
          if (res.ok) {
            const json = await res.json();
            if (json.data) fullText = json.data;
          }
        } catch {
          // ignore
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
          // Attempt automatic background image copy
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
          // Text auto-copy
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

  // Broadcast text/url function
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
        toast.success('Sent to paired devices!', { icon: '🚀' });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Broadcast failed');
      } finally {
        setSending(false);
      }
    },
    [roomCode, deviceId, deviceName, handleIncomingItem]
  );

  // Broadcast screenshot image function
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
        toast.success('Screenshot sent to paired devices! 📸', { icon: '✨' });
      } catch (err) {
        toast.dismiss(toastId);
        toast.error(err instanceof Error ? err.message : 'Failed to send screenshot');
      } finally {
        setSending(false);
      }
    },
    [roomCode, deviceId, deviceName, handleIncomingItem]
  );

  // Disconnect function
  const disconnectSession = useCallback(() => {
    if (pusherRef.current) {
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setIsConnected(false);
    setRoomCode('');
    setPeerCount(1);
    toast('Disconnected from Live Sync session');
  }, []);

  // Connect to room (Pusher with SSE fallback)
  const connectToRoom = useCallback(
    (targetRoom: string) => {
      const cleanRoom = targetRoom.toUpperCase().trim();
      if (!cleanRoom) return;

      setRoomCode(cleanRoom);
      setIsConnected(true);
      toast.success(`Connected to room ${cleanRoom}!`);

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

          const channelName = `presence-room-${cleanRoom}`;
          const channel = pusher.subscribe(channelName);

          channel.bind('pusher:subscription_succeeded', (members: { count: number }) => {
            setPeerCount(Math.max(1, members.count));
          });

          channel.bind('pusher:member_added', () => {
            setPeerCount((prev) => prev + 1);
            toast.success('Another device joined the room!', { icon: '📱' });
          });

          channel.bind('pusher:member_removed', () => {
            setPeerCount((prev) => Math.max(1, prev - 1));
            toast('A device disconnected');
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
          console.warn('Pusher initialization error, falling back to SSE:', err);
        }
      }

      // Always connect SSE fallback stream for seamless transmission
      try {
        const sse = new EventSource(`/api/sync/events?roomId=${cleanRoom}&deviceId=${deviceId}`);
        sseRef.current = sse;

        sse.addEventListener('presence', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.memberCount) setPeerCount((prev) => Math.max(prev, data.memberCount));
          } catch {
            // ignore
          }
        });

        sse.addEventListener('clipboard-sync', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingItem(data);
          } catch {
            // ignore
          }
        });

        sse.onerror = () => {
          // SSE reconnects automatically
        };
      } catch (err) {
        console.warn('SSE fallback error:', err);
      }
    },
    [deviceId, handleIncomingItem]
  );

  // Auto-connect if ?room= query param is present
  useEffect(() => {
    if (urlRoom && !isConnected) {
      connectToRoom(urlRoom);
    }
  }, [urlRoom, isConnected, connectToRoom]);

  // Global paste listener: handles BOTH text and screenshots
  useEffect(() => {
    if (!isConnected || !roomCode) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing text in input fields
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl !== textareaRef.current;

      if (isInput) return;

      const items = e.clipboardData?.items;
      if (items) {
        // Priority 1: Check for screenshot / image
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              const reader = new FileReader();
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                  broadcastImage(dataUrl);
                }
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
      }

      // Priority 2: Text / URL
      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && pastedText.trim().length > 0) {
        broadcastText(pastedText);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isConnected, roomCode, broadcastText, broadcastImage]);

  // Handle image upload from file picker
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          broadcastImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  const handleCreateSession = () => {
    const newCode = generateRoomCode();
    connectToRoom(newCode);
  };

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;
    connectToRoom(joinInput);
    setJoinInput('');
  };

  const handlePasteFromClipboard = async () => {
    try {
      // Check for image in clipboard first
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const reader = new FileReader();
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) broadcastImage(dataUrl);
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }

      // Text fallback
      const text = await navigator.clipboard.readText();
      if (text) {
        setTextInput(text);
        toast.success('Pasted from clipboard');
      }
    } catch {
      toast.error('Unable to access clipboard automatically. Press Ctrl+V directly.');
    }
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/sync?room=${roomCode}`
      : `https://vaultdrop.app/sync?room=${roomCode}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-14 animate-fade-in">
      {/* Hidden file input for screenshot picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3 border border-[var(--border-primary)] bg-[var(--accent-light)] text-[var(--accent)]">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Real-Time Cross-Device Clipboard & Screenshots</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
          Live <span style={{ color: 'var(--accent)' }}>Sync</span>
        </h1>
        <p className="text-sm md:text-base max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Pair your phone, laptop, or tablet. Any text, code, links, or <strong>screenshots</strong> pasted on one device appears instantly on the other.
        </p>
      </div>

      {!isConnected ? (
        /* Pairing Flow */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Create Session Card */}
          <div className="glass-card p-6 md:p-8 flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-light)' }}>
                <Sparkles className="w-6 h-6" style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-xl font-bold mb-2">Create New Session</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Start a fresh room with a 6-character code and instant QR code for mobile camera pairing.
              </p>
            </div>
            <button
              onClick={handleCreateSession}
              className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2"
            >
              <Radio className="w-5 h-5" />
              Create Session
            </button>
          </div>

          {/* Join Session Card */}
          <div className="glass-card p-6 md:p-8 flex flex-col justify-between hover:scale-[1.01] transition-transform">
            <div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-emerald-500/10">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Join Existing Room</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Enter the 6-character code shown on your other device or shared by a peer.
              </p>
            </div>
            <form onSubmit={handleJoinSession} className="space-y-3">
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="e.g. 7KP9XA"
                className="input text-center text-lg font-mono tracking-widest uppercase font-semibold"
                maxLength={8}
              />
              <button
                type="submit"
                disabled={!joinInput.trim()}
                className="btn-secondary w-full py-3.5 text-base flex items-center justify-center gap-2"
              >
                Join Room
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Connected Session View */
        <div className="space-y-6">
          {/* Top Status & Controls Bar */}
          <div className="glass-card p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 relative" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                    Room Code
                  </span>
                  <span className="font-mono font-bold text-lg text-[var(--accent)] tracking-wider">
                    {roomCode}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {peerCount > 1 ? `${peerCount} devices active` : 'Waiting for Device B to connect...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQRModal(true)}
                className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
                title="Show QR Code for phone scan"
              >
                <QrCode className="w-4 h-4" />
                <span>Show QR</span>
              </button>

              <button
                onClick={() => copyToClipboard(shareUrl)}
                className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
                title="Copy Invite Link"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Copy Link</span>
              </button>

              <button
                onClick={disconnectSession}
                className="btn-danger px-3 py-2 text-xs flex items-center gap-1.5"
                title="Leave room and stop syncing"
              >
                <PowerOff className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          {/* Global Paste Banner */}
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs sm:text-sm flex items-center gap-2.5 text-emerald-400">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>
              <strong>Global Paste Active:</strong> Press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[11px]">Ctrl</kbd>+
              <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[11px]">V</kbd> anywhere
              to broadcast text, links, or <strong>screenshots</strong> instantly to paired devices!
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
                  onClick={handlePasteFromClipboard}
                  className="text-xs hover:underline flex items-center gap-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Copy className="w-3 h-3" /> Paste Clipboard
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs hover:underline flex items-center gap-1 text-[var(--accent)]"
                >
                  <Camera className="w-3 h-3" /> Send Image
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
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send to Devices
              </button>
            </div>
          </div>

          {/* Synced Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-[var(--accent)]" />
                Synced Clipboard Stream
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                  {syncHistory.length} item{syncHistory.length === 1 ? '' : 's'}
                </span>
              </h2>
              {syncHistory.length > 0 && (
                <button
                  onClick={() => setSyncHistory([])}
                  className="text-xs flex items-center gap-1 hover:text-red-400 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Stream
                </button>
              )}
            </div>

            {syncHistory.length === 0 ? (
              <div className="glass-card p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-[var(--bg-secondary)]">
                  <Clipboard className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <p className="font-semibold text-sm">No items synced yet</p>
                <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Press <kbd className="font-mono bg-[var(--bg-secondary)] px-1 rounded border border-[var(--border-secondary)]">Ctrl+V</kbd> anywhere to paste text, links, or screenshots. It will show up here instantly in real-time.
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
                            {item.isSelf ? (
                              <Laptop className="w-3 h-3" />
                            ) : (
                              <Smartphone className="w-3 h-3" />
                            )}
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
                                title="Enlarge preview"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                onClick={() => downloadImage(item.text, `screenshot-${item.id}.png`)}
                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                                title="Download image file"
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
      )}

      {/* Screenshot Enlarge Modal */}
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

      {/* QR Code Modal for Mobile Camera Pairing */}
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
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="M"
                includeMargin={false}
              />
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

export default function LiveSyncPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="skeleton w-48 h-8 mx-auto mb-4" />
          <div className="skeleton w-full max-w-md h-32 mx-auto" />
        </div>
      }
    >
      <LiveSyncContent />
    </Suspense>
  );
}
