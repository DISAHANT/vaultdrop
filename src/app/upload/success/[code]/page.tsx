'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, Link as LinkIcon, QrCode, ExternalLink, Plus, Clock, Download, Lock, Shield, FileText } from 'lucide-react';
import { formatBytes, timeUntilExpiry, CONFIG } from '@/lib/config';

interface ShareData {
  shareCode: string;
  title: string | null;
  totalFiles: number;
  totalSize: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  hasPassword: boolean;
  url: string;
}

export default function SuccessPage() {
  const params = useParams();
  const code = params.code as string;
  const [share, setShare] = useState<ShareData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/api/shares/${code}`).then(r => r.json()).then(data => {
      const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : CONFIG.APP_URL;
      setShare({
        shareCode: data.shareCode,
        title: data.title,
        totalFiles: data.totalFiles,
        totalSize: data.totalSize,
        expiresAt: data.expiresAt,
        maxDownloads: data.maxDownloads,
        hasPassword: data.hasPassword,
        url: `${baseUrl}/receive/${data.shareCode}`,
      });
    });
  }, [code]);

  useEffect(() => {
    if (share && qrRef.current) {
      import('qrcode').then(QRCode => {
        QRCode.toCanvas(qrRef.current, share.url, {
          width: 200,
          margin: 2,
          color: { dark: '#0a0a0b', light: '#ffffff' },
        });
      });
    }
  }, [share]);

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = async () => {
    if (navigator.share && share) {
      try {
        await navigator.share({ title: 'VaultDrop Share', text: `Download files: ${share.shareCode}`, url: share.url });
      } catch { /* user cancelled */ }
    }
  };

  if (!share) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="skeleton w-64 h-8 mx-auto mb-4" />
        <div className="skeleton w-48 h-20 mx-auto mb-6" />
        <div className="skeleton w-full h-12 mb-3" />
        <div className="skeleton w-full h-12" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
      {/* Success header */}
      <div className="text-center mb-10 animate-fade-up">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
          <Check className="w-8 h-8" style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Files Ready to Share</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{share.title || 'Your files have been securely stored'}</p>
      </div>

      {/* Share Code */}
      <div className="glass-card p-8 text-center mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>SHARE CODE</p>
        <div className="share-code mb-6">{share.shareCode}</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => copyText(share.shareCode, 'Code')} className="btn-secondary py-2.5 text-sm">
            {copied === 'Code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy Code
          </button>
          <button onClick={() => copyText(share.url, 'Link')} className="btn-secondary py-2.5 text-sm">
            {copied === 'Link' ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            Copy Link
          </button>
          <button onClick={handleShare} className="btn-secondary py-2.5 text-sm">
            <ExternalLink className="w-4 h-4" />
            Share
          </button>
          <Link href={`/receive/${share.shareCode}`} className="btn-secondary py-2.5 text-sm">
            <FileText className="w-4 h-4" />
            Open
          </Link>
        </div>
      </div>

      {/* QR Code */}
      <div className="glass-card p-6 text-center mb-6 animate-fade-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <QrCode className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium">Scan to Download</p>
        </div>
        <div className="inline-block p-3 rounded-xl bg-white">
          <canvas ref={qrRef} />
        </div>
      </div>

      {/* Share Details */}
      <div className="glass-card p-6 mb-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <Shield className="w-5 h-5 mx-auto mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-bold">{share.totalFiles}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Files</p>
          </div>
          <div>
            <FileText className="w-5 h-5 mx-auto mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-bold">{formatBytes(BigInt(share.totalSize))}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Size</p>
          </div>
          <div>
            <Clock className="w-5 h-5 mx-auto mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-bold">{share.expiresAt ? timeUntilExpiry(new Date(share.expiresAt)) : 'Never'}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Expires</p>
          </div>
          <div>
            <Download className="w-5 h-5 mx-auto mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-bold">{share.maxDownloads || '∞'}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Max Downloads</p>
          </div>
        </div>
        {share.hasPassword && (
          <div className="mt-4 pt-4 flex items-center justify-center gap-2 text-sm" style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
            <Lock className="w-4 h-4" /> Password protected
          </div>
        )}
      </div>

      <Link href="/upload" className="btn-secondary w-full py-4 text-base">
        <Plus className="w-5 h-5" />
        Create Another Share
      </Link>
    </div>
  );
}
