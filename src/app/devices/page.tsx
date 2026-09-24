'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Laptop, Smartphone, Monitor, Tablet, Radio, Edit3,
  Trash2, Send, QrCode, RefreshCw, Check, X, Shield,
  ArrowRight, Loader2, Plus, Sparkles
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getOrCreateDeviceId, getDefaultDeviceName, saveCustomDeviceName } from '@/lib/device';
import { SendToDeviceModal, type TransferPayload } from '@/components/send-to-device-modal';

interface UserDeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser: string | null;
  os: string | null;
  isOnline: boolean;
  computedStatus: 'online' | 'idle' | 'offline';
  lastSeenAt: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export default function DevicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [devices, setDevices] = useState<UserDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showPairModal, setShowPairModal] = useState(false);
  const [sendModalPayload, setSendModalPayload] = useState<TransferPayload | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentDeviceId(getOrCreateDeviceId());
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated') {
      fetchDevices();
      const interval = setInterval(fetchDevices, 10000); // 10s auto-refresh
      return () => clearInterval(interval);
    }
  }, [status, router, fetchDevices]);

  const handleStartRename = (device: UserDeviceItem) => {
    setEditingId(device.id);
    setEditingName(device.deviceName);
  };

  const handleSaveRename = async (id: string, isCurrent: boolean) => {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: editingName.trim() }),
      });
      if (res.ok) {
        toast.success('Device renamed');
        if (isCurrent) {
          saveCustomDeviceName(editingName.trim());
        }
        setEditingId(null);
        fetchDevices();
      }
    } catch {
      toast.error('Failed to rename device');
    }
  };

  const handleRemoveDevice = async (id: string, name: string) => {
    if (!confirm(`Disconnect and remove "${name}" from your account?`)) return;
    try {
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${name}" removed`);
        fetchDevices();
      }
    } catch {
      toast.error('Failed to remove device');
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      case 'desktop': return Monitor;
      default: return Laptop;
    }
  };

  const formatLastActive = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 15) return 'Just now';
    if (diff < 60) return `${Math.round(diff)} seconds ago`;
    if (diff < 3600) return `${Math.round(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)} hours ago`;
    return `${Math.round(diff / 86400)} days ago`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--accent)] mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">Loading your connected devices...</p>
      </div>
    );
  }

  const onlineCount = devices.filter(d => d.computedStatus === 'online').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16 space-y-8 animate-fade-up">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-light)] text-[var(--accent)] mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            {onlineCount} Online • {devices.length} Total Devices
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Device Management</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Connected devices associated with your VaultDrop personal bridge
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPairModal(true)}
            className="btn-secondary px-4 py-2.5 text-xs inline-flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4 text-[var(--accent)]" />
            Pair New Device
          </button>
          <button
            onClick={fetchDevices}
            className="p-2.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            title="Refresh device statuses"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Devices List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <span>My Devices</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] font-mono">
            {devices.length}
          </span>
        </h2>

        {devices.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl mx-auto bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
              <Laptop className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">No devices registered yet</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              Your device will register automatically upon signing in. Open VaultDrop on your phone or other laptop with this same account to establish the bridge.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {devices.map((device) => {
              const Icon = getDeviceIcon(device.deviceType);
              const isCurrent = device.deviceId === currentDeviceId;
              const isEditing = editingId === device.id;

              return (
                <div
                  key={device.id}
                  className={`glass-card p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                    isCurrent
                      ? 'border-cyan-400/60 shadow-[0_4px_25px_rgba(0,240,255,0.25)] bg-[var(--bg-card)]'
                      : 'border-[var(--border-primary)] hover:border-cyan-400/40 bg-[var(--bg-card)]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Device Icon with status dot */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                        <Icon className="w-6 h-6 text-[var(--text-primary)]" />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-card)] ${
                          device.computedStatus === 'online'
                            ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                            : device.computedStatus === 'idle'
                            ? 'bg-amber-500'
                            : 'bg-neutral-400'
                        }`}
                        title={device.computedStatus}
                      />
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="input py-1 px-2.5 text-sm h-8 max-w-[200px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(device.id, isCurrent);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveRename(device.id, isCurrent)}
                            className="p-1 rounded bg-[var(--accent)] text-white hover:opacity-90"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-base text-[var(--text-primary)] truncate">
                            {device.deviceName}
                          </h3>
                          {isCurrent && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/30">
                              This Device
                            </span>
                          )}
                          <button
                            onClick={() => handleStartRename(device)}
                            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded"
                            title="Rename device"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] flex-wrap">
                        <span className="capitalize font-medium">{device.deviceType}</span>
                        {device.os && <span>• {device.os}</span>}
                        {device.browser && <span>• {device.browser}</span>}
                        <span>•</span>
                        <span className="font-medium text-[var(--text-tertiary)]">
                          {device.computedStatus === 'online'
                            ? 'Online now'
                            : `Last seen ${formatLastActive(device.lastSeenAt)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!isCurrent && (
                      <button
                        onClick={() =>
                          setSendModalPayload({
                            title: 'Quick Note / Text',
                            type: 'text',
                            content: `Hello from ${getDefaultDeviceName()}!`,
                          })
                        }
                        className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5 text-[var(--accent)]" />
                        Send to device
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveDevice(device.id, device.deviceName)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Disconnect / Remove device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Pairing Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowPairModal(false)}>
          <div className="glass-card max-w-sm w-full p-6 text-center space-y-4 animate-scale-in relative border border-[var(--border-primary)] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowPairModal(false)}
              className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl mx-auto bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-lg">Pair Mobile Device</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Scan this QR code from your phone or tablet camera to open VaultDrop and automatically link as a new device.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-md">
              <QRCodeSVG
                value={typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://vaultdrop-eta.vercel.app/login'}
                size={180}
                level="M"
              />
            </div>

            <p className="text-xs text-[var(--text-tertiary)]">
              Ensure you sign in with the same account (<span className="text-[var(--text-primary)] font-medium">{session?.user?.email}</span>) on the mobile device.
            </p>
          </div>
        </div>
      )}

      {/* Send to device modal */}
      <SendToDeviceModal
        isOpen={Boolean(sendModalPayload)}
        onClose={() => setSendModalPayload(null)}
        payload={sendModalPayload}
      />
    </div>
  );
}
