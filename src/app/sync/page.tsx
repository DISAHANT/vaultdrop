'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Laptop,
  Smartphone,
  Copy,
  Check,
  QrCode,
  Link as LinkIcon,
  Radio,
  Sparkles,
  Clipboard,
  Trash2,
  Users,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Camera,
  Clock,
  Infinity as InfinityIcon,
  Plus,
  LogIn,
  AlertCircle,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface ActiveSessionItem {
  id: string;
  code: string;
  title: string | null;
  type: 'TEMPORARY' | 'PERMANENT';
  status: string;
  expiresAt: string | null;
  createdAt: string;
  lastActiveAt: string;
  clipsCount?: number;
  devicesCount?: number;
  onlineDevicesCount?: number;
}

function LiveSyncHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRoom = searchParams.get('room') || searchParams.get('code');
  const { data: authSession, status: authStatus } = useSession();

  // Create Form State
  const [sessionType, setSessionType] = useState<'TEMPORARY' | 'PERMANENT'>('TEMPORARY');
  const [sessionTitle, setSessionTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join Form State
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // User Active Sessions State
  const [userSessions, setUserSessions] = useState<ActiveSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Auto-redirect if URL contains ?room= or ?code=
  useEffect(() => {
    if (!urlRoom) return;

    const targetCode = urlRoom.toUpperCase().trim();
    if (targetCode.length >= 4) {
      // Validate code before redirecting
      fetch(`/api/sync/session/${targetCode}`)
        .then(async (res) => {
          if (res.ok) {
            router.replace(`/sync/${targetCode}`);
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'Invalid session code from URL');
          }
        })
        .catch(() => {
          toast.error('Failed to verify session code from URL');
        });
    }
  }, [urlRoom, router]);

  // Load authenticated user's active sessions
  const loadUserSessions = useCallback(async () => {
    if (authStatus !== 'authenticated') return;
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/sync/session');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setUserSessions(data.sessions);
        }
      }
    } catch {
      // silent fail on fetch
    } finally {
      setLoadingSessions(false);
    }
  }, [authStatus]);

  useEffect(() => {
    loadUserSessions();
  }, [loadUserSessions]);

  // Handle Create Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const res = await fetch('/api/sync/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sessionType,
          title: sessionTitle.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create session');
      }

      const created = await res.json();
      const code = created.code || created.session?.code;

      if (!code) {
        throw new Error('No session code returned');
      }

      toast.success(
        sessionType === 'PERMANENT'
          ? 'Permanent Live Sync room created!'
          : 'Temporary 24h Live Sync session created!',
        { icon: '🚀' }
      );

      // Redirect immediately to the persistent session URL
      router.push(`/sync/${code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Session creation failed');
      setIsCreating(false);
    }
  };

  // Handle Join Session
  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.toUpperCase().trim();

    if (!cleanCode || cleanCode.length < 4) {
      toast.error('Please enter a valid 6-character session code');
      return;
    }

    setIsJoining(true);
    try {
      // Strictly validate against the database — do NOT create with arbitrary custom token!
      const res = await fetch(`/api/sync/session/${cleanCode}`);

      if (res.status === 404) {
        toast.error('Invalid session code. No room found with this code.', {
          description: 'Please double-check the 6-character code or ask the host.',
        });
        setIsJoining(false);
        return;
      }

      if (res.status === 410) {
        toast.error('This sync session has expired (24h limit reached).', {
          description: 'Please create a new session or join an active permanent room.',
        });
        setIsJoining(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to join session');
      }

      toast.success('Session verified! Connecting...', { icon: '⚡' });
      router.push(`/sync/${cleanCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not join session');
      setIsJoining(false);
    }
  };

  // Handle Delete Session
  const handleDeleteSession = async (code: string) => {
    if (!confirm(`Are you sure you want to delete session ${code}? All connected devices will be disconnected.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sync/session/${code}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete session');
      }

      toast.success(`Session ${code} deleted`);
      setUserSessions((prev) => prev.filter((s) => s.code !== code));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const copyCodeToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast.success(`Copied room code ${code} to clipboard!`);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="text-center mb-10 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold border border-[var(--accent)]/20 mb-2">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Real-Time Live Sync 2.0</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-zinc-100 via-emerald-300 to-zinc-400 bg-clip-text text-transparent">
          Cross-Device Shared Clipboard
        </h1>
        <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Instantly sync text, links, and direct screenshot pastes across phones, laptops, and PCs.
          Retains 24-hour clip history, live device presence, and dedicated room URLs.
        </p>
      </div>

      {/* User's Active Sessions Section (for signed-in users) */}
      {authStatus === 'authenticated' && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-lg font-bold">Your Saved & Active Sessions</h2>
              <span className="badge bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs">
                {userSessions.length}
              </span>
            </div>
            <button
              onClick={loadUserSessions}
              disabled={loadingSessions}
              className="text-xs btn-secondary px-3 py-1.5 flex items-center gap-1.5"
              title="Refresh sessions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingSessions && userSessions.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
              Loading your active sessions...
            </div>
          ) : userSessions.length === 0 ? (
            <div className="glass-card p-6 text-center border-dashed">
              <Clipboard className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)]" />
              <p className="font-semibold text-sm">No saved sessions yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Create a permanent or temporary session below to pair your devices.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userSessions.map((session) => {
                const isPermanent = session.type === 'PERMANENT';
                const hasOnlineDevices = (session.onlineDevicesCount || 0) > 0;

                return (
                  <div
                    key={session.id}
                    className="glass-card p-5 space-y-4 hover:border-[var(--accent)] transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-1 rounded-md border border-[var(--accent)]/30">
                          #{session.code}
                        </span>

                        <div className="flex items-center gap-2">
                          {isPermanent ? (
                            <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs flex items-center gap-1">
                              <InfinityIcon className="w-3 h-3" />
                              Permanent
                            </span>
                          ) : (
                            <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              24h Temporary
                            </span>
                          )}

                          {hasOnlineDevices ? (
                            <span className="badge badge-active text-xs flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {session.onlineDevicesCount} online
                            </span>
                          ) : (
                            <span className="badge bg-zinc-800 text-zinc-400 text-xs">
                              Idle
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Info */}
                      <h3 className="font-bold text-base line-clamp-1">
                        {session.title || (isPermanent ? `Permanent Room ${session.code}` : `Live Session ${session.code}`)}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Last active {new Date(session.lastActiveAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-secondary)] gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyCodeToClipboard(session.code)}
                          className="btn-secondary px-2.5 py-1.5 text-xs flex items-center gap-1"
                          title="Copy Code"
                        >
                          {copiedCode === session.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Copy Code</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.code)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => router.push(`/sync/${session.code}`)}
                        className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Jump In</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Create Session vs Join Session */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-12">
        {/* Create Session Card */}
        <div className="glass-card p-6 sm:p-7 relative overflow-hidden space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] mb-3">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">Create New Session</h2>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
              Launch a live room with a dedicated URL and QR code.
            </p>
          </div>

          <form onSubmit={handleCreateSession} className="space-y-5">
            {/* Session Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                Session Type
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Temporary Option */}
                <div
                  onClick={() => setSessionType('TEMPORARY')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    sessionType === 'TEMPORARY'
                      ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Temporary
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      24h Auto
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Auto-expires in 24 hours. Great for quick pairing and one-off transfers.
                  </p>
                </div>

                {/* Permanent Option */}
                <div
                  onClick={() => setSessionType('PERMANENT')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    sessionType === 'PERMANENT'
                      ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <InfinityIcon className="w-3.5 h-3.5 text-purple-400" />
                      Permanent
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                      Always On
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Never expires. Keeps devices paired always with live presence.
                  </p>
                </div>
              </div>
            </div>

            {/* Session Title Input (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="session-title" className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                Session Label (Optional)
              </label>
              <input
                id="session-title"
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder={sessionType === 'PERMANENT' ? 'e.g. My MacBook & iPhone' : 'e.g. Quick Transfer'}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:border-[var(--accent)] transition-all"
                maxLength={60}
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Room & Redirecting...</span>
                </>
              ) : (
                <>
                  <span>Create & Launch Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {authStatus !== 'authenticated' && sessionType === 'PERMANENT' && (
            <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Tip: <Link href="/login" className="underline font-semibold">Sign in</Link> to save permanent sessions to your account dashboard!
              </span>
            </p>
          )}
        </div>

        {/* Join Session Card */}
        <div className="glass-card p-6 sm:p-7 space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
              <Radio className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">Join Existing Session</h2>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
              Enter the 6-character room code from your paired device.
            </p>
          </div>

          <form onSubmit={handleJoinSession} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="join-code" className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                Room Code
              </label>
              <div className="relative">
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="e.g. 7K2M9X"
                  className="w-full text-center font-mono text-xl sm:text-2xl tracking-[0.3em] font-bold py-3.5 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:border-[var(--accent)] transition-all uppercase placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                  maxLength={6}
                  required
                />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                Tokens are validated against active database rooms before connecting.
              </p>
            </div>

            <button
              type="submit"
              disabled={isJoining || joinCode.trim().length < 4}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Session Code...</span>
                </>
              ) : (
                <>
                  <span>Join Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Info Box */}
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)] space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-[var(--accent)]" />
              Scanning with your phone camera?
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Open your phone camera and scan the QR code displayed in the session room on your other device. It will automatically redirect you straight into the live session!
            </p>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[var(--border-secondary)]">
        <div className="glass-card p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm">Sub-100ms Sync</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Real-time Pusher Channels with instant SSE fallback for lightning-fast cross-device updates.
          </p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm">24-Hour Clip History</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Clips and screenshots stay securely preserved in the database for 24 hours across browser reloads.
          </p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Camera className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm">Screenshot Paste</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Press Ctrl+V anywhere in a session to instantly broadcast screenshots without saving files first.
          </p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm">Device Presence Tab</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Live presence badges show exactly which devices are online or offline with last-seen timestamps.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LiveSyncPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent)]" />
        </div>
      }
    >
      <LiveSyncHub />
    </Suspense>
  );
}
