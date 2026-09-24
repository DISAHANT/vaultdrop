'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Download, Copy, X, Check, ArrowDownToLine,
  Smartphone, Laptop, Monitor, AlertCircle, FileText
} from 'lucide-react';
import { getOrCreateDeviceId, registerCurrentDevice, sendDeviceHeartbeat } from '@/lib/device';
import { formatBytes } from '@/lib/config';

interface IncomingTransfer {
  id: string;
  senderDeviceName: string;
  title: string;
  type: string;
  content: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: string | null;
  mimeType: string | null;
  createdAt: string;
}

export function IncomingTransferListener() {
  const { data: session } = useSession();
  const [activeTransfer, setActiveTransfer] = useState<IncomingTransfer | null>(null);
  const [copied, setCopied] = useState(false);

  // Register device and maintain heartbeat
  useEffect(() => {
    if (session?.user) {
      registerCurrentDevice();
      sendDeviceHeartbeat();

      const interval = setInterval(() => {
        sendDeviceHeartbeat();
      }, 30000); // 30s heartbeat

      return () => clearInterval(interval);
    }
  }, [session]);

  const checkPendingTransfers = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const deviceId = getOrCreateDeviceId();
    try {
      const res = await fetch(`/api/devices/transfers?targetDeviceId=${encodeURIComponent(deviceId)}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        if (data.transfers && data.transfers.length > 0) {
          setActiveTransfer(data.transfers[0]);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkPendingTransfers();
    const interval = setInterval(checkPendingTransfers, 5000); // Poll every 5s for pending transfers
    return () => clearInterval(interval);
  }, [checkPendingTransfers]);

  const handleAccept = async () => {
    if (!activeTransfer) return;

    try {
      await fetch(`/api/devices/transfers/${activeTransfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      // Handle based on transfer type
      if (activeTransfer.type === 'clipboard' || activeTransfer.type === 'text') {
        if (activeTransfer.content) {
          try {
            await navigator.clipboard.writeText(activeTransfer.content);
            toast.success('Copied to clipboard! 📋');
          } catch {
            toast.info('Clipboard write restricted. Use the copy button.');
          }
        }
      } else if (activeTransfer.fileKey || activeTransfer.fileName) {
        // If fileKey is present, download via download route or create link
        toast.success(`Received "${activeTransfer.fileName || activeTransfer.title}"`);
      }

      setActiveTransfer(null);
    } catch {
      toast.error('Failed to complete transfer');
    }
  };

  const handleDecline = async () => {
    if (!activeTransfer) return;
    try {
      await fetch(`/api/devices/transfers/${activeTransfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' }),
      });
    } catch {}
    setActiveTransfer(null);
    toast.info('Transfer declined');
  };

  const copyContentManually = () => {
    if (!activeTransfer?.content) return;
    navigator.clipboard.writeText(activeTransfer.content);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeTransfer) return null;

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-fade-down">
      <div className="backdrop-blur-xl bg-neutral-950/95 text-white p-5 rounded-2xl border border-emerald-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Incoming Transfer
            </span>
          </div>
          <button
            onClick={handleDecline}
            className="text-neutral-400 hover:text-white p-1 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white truncate">{activeTransfer.title}</h4>
          <p className="text-xs text-neutral-400">
            From <span className="text-neutral-200 font-medium">{activeTransfer.senderDeviceName}</span>
            {activeTransfer.fileSize && (
              <span> • {formatBytes(BigInt(activeTransfer.fileSize))}</span>
            )}
          </p>
        </div>

        {/* Content preview if text / clipboard */}
        {activeTransfer.content && (
          <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono max-h-24 overflow-y-auto text-neutral-300 break-all select-all">
            {activeTransfer.content.slice(0, 300)}
            {activeTransfer.content.length > 300 && '...'}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {activeTransfer.content && (
            <button
              onClick={copyContentManually}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          )}

          <button
            onClick={handleAccept}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-sm"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Accept
          </button>

          <button
            onClick={handleDecline}
            className="py-2 px-3 rounded-xl hover:bg-white/10 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
