'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, FileText, Image, Film, Music, Archive, FileIcon, Lock, Clock, AlertTriangle, XCircle, Eye, Loader2 } from 'lucide-react';
import { formatBytes, timeUntilExpiry } from '@/lib/config';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return Archive;
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document')) return FileText;
  return FileIcon;
}

interface ShareFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: string;
  createdAt: string;
}

interface ShareData {
  id: string;
  shareCode: string;
  title: string | null;
  description: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  totalFiles: number;
  totalSize: string;
  status: string;
  createdAt: string;
  files: ShareFile[];
}

export default function ShareViewPage() {
  const params = useParams();
  const code = params.code as string;
  const [share, setShare] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ShareFile | null>(null);

  const fetchShare = useCallback(async () => {
    try {
      const res = await fetch(`/api/shares/${code}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Share not found');
        return;
      }
      const data: ShareData = await res.json();
      setShare(data);

      if (data.status !== 'ACTIVE') {
        setError(data.status === 'EXPIRED' ? 'This share has expired.' : data.status === 'REVOKED' ? 'This share has been revoked.' : 'Share unavailable.');
        return;
      }

      if (data.hasPassword) {
        setPasswordRequired(true);
      } else {
        setVerified(true);
      }
    } catch {
      setError('Failed to load share.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchShare();
  }, [fetchShare]);

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const res = await fetch(`/api/shares/${code}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setVerified(true);
        setPasswordRequired(false);
        toast.success('Access granted');
      } else {
        toast.error('Incorrect password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const downloadFile = async (file: ShareFile) => {
    setDownloading(file.id);
    try {
      const res = await fetch(`/api/shares/${code}/files/${file.id}/download?json=true`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Download failed');
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.downloadUrl) {
          const a = document.createElement('a');
          a.href = data.downloadUrl;
          a.download = file.originalFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success(`Downloading "${file.originalFilename}"`);
          return;
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded "${file.originalFilename}"`);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    setDownloading('all');
    try {
      const res = await fetch(`/api/shares/${code}/download-all`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Download failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${share?.title || `VaultDrop-${code}`}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('All files downloaded');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="skeleton w-48 h-8 mx-auto mb-6" />
        <div className="glass-card p-6 space-y-4">
          <div className="skeleton w-full h-16" />
          <div className="skeleton w-full h-16" />
          <div className="skeleton w-full h-16" />
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    const isExpired = error.includes('expired');
    const isRevoked = error.includes('revoked');
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: isExpired ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
          {isExpired ? <Clock className="w-8 h-8 text-amber-500" /> : isRevoked ? <XCircle className="w-8 h-8 text-red-500" /> : <AlertTriangle className="w-8 h-8 text-red-500" />}
        </div>
        <h1 className="text-2xl font-bold mb-3">{isExpired ? 'Share Expired' : isRevoked ? 'Share Revoked' : 'Share Not Found'}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  // Password gate
  if (passwordRequired && !verified) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
            <Lock className="w-8 h-8" style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Password Required</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This share is protected. Enter the password to continue.</p>
        </div>
        <form onSubmit={verifyPassword} className="glass-card p-6">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="input mb-4" autoFocus />
          <button type="submit" disabled={verifying || !password} className="btn-primary w-full">
            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            {verifying ? 'Verifying...' : 'Unlock'}
          </button>
        </form>
      </div>
    );
  }

  if (!share) return null;

  const remaining = share.maxDownloads ? share.maxDownloads - share.downloadCount : null;
  const limitReached = remaining !== null && remaining <= 0;

  // Preview modal
  const previewModal = previewFile && previewFile.mimeType.startsWith('image/') ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewFile(null)}>
      <div className="relative max-w-4xl max-h-[90vh] animate-scale-in" onClick={e => e.stopPropagation()}>
        <img src={`/api/shares/${code}/files/${previewFile.id}/download`} alt={previewFile.originalFilename} className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        <button onClick={() => setPreviewFile(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black">×</button>
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
      {previewModal}

      {/* Header */}
      <div className="text-center mb-8 animate-fade-up">
        <h1 className="text-3xl font-bold mb-2">{share.title || 'Shared Files'}</h1>
        {share.description && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{share.description}</p>}
      </div>

      {/* Stats bar */}
      <div className="glass-card p-4 mb-6 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
          <div><span className="block text-lg font-bold">{share.totalFiles}</span><span style={{ color: 'var(--text-tertiary)' }}>Files</span></div>
          <div><span className="block text-lg font-bold">{formatBytes(BigInt(share.totalSize))}</span><span style={{ color: 'var(--text-tertiary)' }}>Size</span></div>
          <div><span className="block text-lg font-bold">{share.expiresAt ? timeUntilExpiry(new Date(share.expiresAt)) : 'Never'}</span><span style={{ color: 'var(--text-tertiary)' }}>Expires</span></div>
          <div><span className="block text-lg font-bold">{remaining !== null ? remaining : '∞'}</span><span style={{ color: 'var(--text-tertiary)' }}>Downloads left</span></div>
        </div>
      </div>

      {limitReached ? (
        <div className="glass-card p-8 text-center animate-fade-up">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-bold mb-2">Download Limit Reached</h2>
          <p style={{ color: 'var(--text-secondary)' }}>This share has reached its maximum download count.</p>
        </div>
      ) : (
        <>
          {/* Download all */}
          {share.files.length > 1 && (
            <button onClick={downloadAll} disabled={downloading === 'all'} className="btn-primary w-full py-4 mb-4 text-base animate-fade-up" style={{ animationDelay: '0.1s' }}>
              {downloading === 'all' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Download All ({share.totalFiles} files as ZIP)
            </button>
          )}

          {/* Files */}
          <div className="space-y-2 animate-fade-up" style={{ animationDelay: '0.15s' }}>
            {share.files.map((file) => {
              const Icon = getFileIcon(file.mimeType);
              const isImage = file.mimeType.startsWith('image/');
              return (
                <div key={file.id} className="file-card group">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-light)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.originalFilename}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatBytes(BigInt(file.fileSize))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isImage && (
                      <button onClick={() => setPreviewFile(file)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" title="Preview">
                        <Eye className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                    )}
                    <button
                      onClick={() => downloadFile(file)}
                      disabled={downloading === file.id}
                      className="p-2 rounded-lg hover:bg-[var(--accent-light)] transition-colors"
                      title="Download"
                    >
                      {downloading === file.id ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} /> : <Download className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
