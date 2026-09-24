'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Laptop, Smartphone, Monitor, Tablet, Send, X,
  CheckCircle2, Loader2, ArrowRight
} from 'lucide-react';
import { getOrCreateDeviceId, getDefaultDeviceName } from '@/lib/device';
import { formatBytes } from '@/lib/config';

export interface TransferPayload {
  title: string;
  type: 'file' | 'clipboard' | 'workspace' | 'text' | 'image';
  content?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number | string;
  mimeType?: string;
}

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
}

interface SendToDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload?: TransferPayload | null;
  itemTitle?: string;
  itemType?: string;
  itemPayload?: any;
}

export function SendToDeviceModal({
  isOpen,
  onClose,
  payload,
  itemTitle,
  itemType,
  itemPayload,
}: SendToDeviceModalProps) {
  const [devices, setDevices] = useState<UserDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const currentDeviceId = typeof window !== 'undefined' ? getOrCreateDeviceId() : '';

  const activePayload: TransferPayload | null = payload || (itemTitle ? {
    title: itemTitle,
    type: (itemType as any) || 'file',
    content: typeof itemPayload === 'string' ? itemPayload : itemPayload?.content || JSON.stringify(itemPayload || {}),
    fileName: itemPayload?.fileName || itemPayload?.projectName,
    fileSize: itemPayload?.fileSize || itemPayload?.totalBytes,
    fileKey: itemPayload?.fileKey || itemPayload?.workspaceId,
  } : null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/devices')
      .then(res => res.json())
      .then(data => {
        if (data.devices) {
          setDevices(data.devices);
          // Pick the first other device by default
          const other = data.devices.find((d: UserDeviceItem) => d.deviceId !== currentDeviceId);
          if (other) setSelectedDeviceId(other.deviceId);
        }
      })
      .catch(() => toast.error('Failed to load devices'))
      .finally(() => setLoading(false));
  }, [isOpen, currentDeviceId]);

  if (!isOpen || !activePayload) return null;


  const handleSend = async () => {
    if (!selectedDeviceId) {
      toast.error('Please select a target device');
      return;
    }

    const targetDevice = devices.find(d => d.deviceId === selectedDeviceId);
    setSending(true);

    try {
      const res = await fetch('/api/devices/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDeviceId: selectedDeviceId,
          targetDeviceName: targetDevice?.deviceName || 'Target Device',
          senderDeviceId: currentDeviceId,
          senderDeviceName: getDefaultDeviceName(),
          title: activePayload.title,
          type: activePayload.type,
          content: activePayload.content,
          fileKey: activePayload.fileKey,
          fileName: activePayload.fileName,
          fileSize: activePayload.fileSize ? Number(activePayload.fileSize) : undefined,
          mimeType: activePayload.mimeType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Transfer failed');
      }

      toast.success(`Sent to "${targetDevice?.deviceName || 'device'}"! 🚀`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send to device');
    } finally {
      setSending(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-card max-w-md w-full p-6 space-y-5 animate-scale-in relative border border-[var(--border-primary)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent-light)] text-[var(--accent)]">
              <Send className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Send to Device</h3>
              <p className="text-xs text-[var(--text-secondary)]">Transfer directly across your devices</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Item preview */}
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-card)] text-[var(--accent)] font-mono text-xs font-bold shrink-0">
            {activePayload.type.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{activePayload.title}</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {activePayload.fileSize ? formatBytes(BigInt(activePayload.fileSize)) : activePayload.type}
            </p>
          </div>
        </div>

        {/* Device selection list */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Select Target Device
          </label>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
              <p className="text-xs text-[var(--text-tertiary)]">Locating devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-[var(--border-primary)]">
              <p className="text-sm font-medium mb-1">No other devices found</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Sign in with the same account on another phone, laptop, or desktop to send directly.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {devices.map(d => {
                const Icon = getDeviceIcon(d.deviceType);
                const isCurrent = d.deviceId === currentDeviceId;
                const isSelected = selectedDeviceId === d.deviceId;

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      if (!isCurrent) setSelectedDeviceId(d.deviceId);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                      isCurrent
                        ? 'opacity-50 cursor-not-allowed bg-[var(--bg-secondary)] border-transparent'
                        : isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-light)] cursor-pointer shadow-sm'
                        : 'border-[var(--border-primary)] bg-[var(--bg-card)] hover:border-[var(--accent)] cursor-pointer'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)] shrink-0">
                      <Icon className="w-4.5 h-4.5 text-[var(--text-primary)]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{d.deviceName}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-tertiary)]">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                        <span className="capitalize">{d.deviceType}</span>
                        {d.browser && <span>• {d.browser}</span>}
                        {d.os && <span>• {d.os}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          d.computedStatus === 'online'
                            ? 'bg-emerald-500'
                            : d.computedStatus === 'idle'
                            ? 'bg-amber-500'
                            : 'bg-neutral-400'
                        }`}
                        title={d.computedStatus}
                      />
                      {isSelected && !isCurrent && (
                        <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedDeviceId}
            className="btn-primary px-5 py-2 text-xs"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {sending ? 'Sending...' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SendToDeviceModal;

