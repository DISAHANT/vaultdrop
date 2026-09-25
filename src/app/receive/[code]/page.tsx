'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Download, FileText, Image, Film, Music, Archive, FileIcon, Lock,
  Clock, AlertTriangle, XCircle, Eye, Loader2, Activity, CheckCircle2, X
} from 'lucide-react';
import { formatBytes, timeUntilExpiry } from '@/lib/config';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return Archive;
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document')) return FileText;
  return FileIcon;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) return '0 KB/s';
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function formatETA(remainingBytes: number, speedBytesPerSec: number): string {
  if (!speedBytesPerSec || speedBytesPerSec <= 0 || remainingBytes <= 0 || !isFinite(speedBytesPerSec)) return '';
  const seconds = Math.round(remainingBytes / speedBytesPerSec);
  if (seconds < 1) return '< 1s left';
  if (seconds < 60) return `~${seconds}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `~${mins}m ${secs}s left`;
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

interface DownloadProgress {
  id: string; // file.id or 'all'
  filename: string;
  loaded: number;
  total: number;
  percent: number;
  speed: string;
  speedBytes: number;
  eta: string;
  status: 'downloading' | 'completed' | 'error';
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
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [previewFile, setPreviewFile] = useState<ShareFile | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

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

  const cancelDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDownloading(null);
    setDownloadProgress(null);
    toast.info('Download cancelled');
  }, []);

  const triggerFileSave = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const startStreamDownload = async (
    id: string,
    url: string,
    filename: string,
    expectedSize: number,
    mimeType: string
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setDownloading(id);

    setDownloadProgress({
      id,
      filename,
      loaded: 0,
      total: expectedSize,
      percent: 0,
      speed: 'Connecting...',
      speedBytes: 0,
      eta: '',
      status: 'downloading',
    });

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        let errMessage = 'Download failed';
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch {}
        toast.error(errMessage);
        setDownloading(null);
        setDownloadProgress(null);
        return;
      }

      const contentLength = res.headers.get('content-length');
      const total = (contentLength ? parseInt(contentLength, 10) : 0) || expectedSize || 0;

      if (!res.body) {
        const blob = await res.blob();
        triggerFileSave(blob, filename);
        setDownloading(null);
        setDownloadProgress(null);
        toast.success(`Downloaded "${filename}"`);
        return;
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      const startTime = performance.now();
      let lastTime = startTime;
      let lastLoaded = 0;
      let speedEma = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          loaded += value.length;

          const now = performance.now();
          const elapsed = (now - lastTime) / 1000;

          if (elapsed >= 0.15 || loaded === total) {
            const deltaBytes = loaded - lastLoaded;
            const currentSpeed = elapsed > 0 ? deltaBytes / elapsed : 0;
            speedEma = speedEma === 0 ? currentSpeed : speedEma * 0.7 + currentSpeed * 0.3;
            lastTime = now;
            lastLoaded = loaded;

            const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
            const remainingBytes = Math.max(0, total - loaded);
            const eta = speedEma > 0 && remainingBytes > 0 ? formatETA(remainingBytes, speedEma) : '';

            setDownloadProgress({
              id,
              filename,
              loaded,
              total: total || loaded,
              percent,
              speed: formatSpeed(speedEma),
              speedBytes: speedEma,
              eta,
              status: 'downloading',
            });
          }
        }
      }

      setDownloadProgress({
        id,
        filename,
        loaded,
        total: loaded,
        percent: 100,
        speed: formatSpeed(speedEma),
        speedBytes: speedEma,
        eta: 'Complete',
        status: 'completed',
      });

      const blob = new Blob(chunks as unknown as BlobPart[], {
        type: mimeType || res.headers.get('content-type') || 'application/octet-stream',
      });
      triggerFileSave(blob, filename);
      toast.success(`Downloaded "${filename}"`);

      fetchShare();

      setTimeout(() => {
        setDownloading(null);
        setDownloadProgress(null);
      }, 2200);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('Download stream error:', err);
      toast.error('Download failed');
      setDownloading(null);
      setDownloadProgress(null);
    }
  };

  const downloadFile = (file: ShareFile) => {
    startStreamDownload(
      file.id,
      `/api/shares/${code}/files/${file.id}/download`,
      file.originalFilename,
      Number(file.fileSize),
      file.mimeType
    );
  };

  const downloadAll = () => {
    const zipName = `${share?.title || `VaultDrop-${code}`}.zip`;
    startStreamDownload(
      'all',
      `/api/shares/${code}/download-all`,
      zipName,
      Number(share?.totalSize) || 0,
      'application/zip'
    );
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
            downloadProgress?.id === 'all' ? (
              <div className="glass-card p-5 mb-4 border border-[var(--accent)] shadow-lg space-y-3 animate-fade-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--accent-light)]">
                    {downloadProgress.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Archive className="w-5 h-5 animate-pulse text-[var(--accent)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate">
                        {downloadProgress.status === 'completed' ? 'ZIP Archive Downloaded' : 'Packaging & Downloading All Files...'}
                      </p>
                      <span className="font-mono text-sm font-bold text-[var(--accent)]">{downloadProgress.percent}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-wrap mt-0.5">
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <Activity className="w-3.5 h-3.5 animate-pulse" />
                        {downloadProgress.speed}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {formatBytes(BigInt(downloadProgress.loaded))} / {formatBytes(BigInt(downloadProgress.total || share.totalSize))}
                      </span>
                      {downloadProgress.eta && (
                        <>
                          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                          <span className="text-amber-500 font-medium">{downloadProgress.eta}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {downloadProgress.status === 'downloading' && (
                    <button
                      onClick={cancelDownload}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                      title="Cancel download"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="relative w-full h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-all duration-150 bg-neutral-900 dark:bg-white"
                    style={{
                      width: `${downloadProgress.percent}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={downloadAll}
                disabled={!!downloading}
                className="btn-primary w-full py-4 mb-4 text-base animate-fade-up"
                style={{ animationDelay: '0.1s' }}
              >
                <Download className="w-5 h-5" />
                Download All ({share.totalFiles} files as ZIP)
              </button>
            )
          )}

          {/* Files List */}
          <div className="space-y-2 animate-fade-up" style={{ animationDelay: '0.15s' }}>
            {share.files.map((file) => {
              const Icon = getFileIcon(file.mimeType);
              const isImage = file.mimeType.startsWith('image/');
              const isThisDownloading = downloadProgress?.id === file.id;

              if (isThisDownloading) {
                return (
                  <div
                    key={file.id}
                    className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--bg-card)] shadow-lg transition-all space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--accent-light)]">
                        {downloadProgress.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-scale-in" />
                        ) : (
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold truncate">{file.originalFilename}</p>
                          <span className="font-mono text-sm font-bold text-[var(--accent)]">
                            {downloadProgress.percent}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs flex-wrap mt-0.5">
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <Activity className="w-3.5 h-3.5 animate-pulse" />
                            {downloadProgress.speed}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {formatBytes(BigInt(downloadProgress.loaded))} / {formatBytes(BigInt(downloadProgress.total || file.fileSize))}
                          </span>
                          {downloadProgress.eta && (
                            <>
                              <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                              <span className="text-amber-500 font-medium">{downloadProgress.eta}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {downloadProgress.status === 'downloading' && (
                        <button
                          onClick={cancelDownload}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                          title="Cancel download"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-neutral-200 dark:bg-white/[0.08]">
                      <div
                        className="h-full rounded-full transition-all duration-150 bg-neutral-900 dark:bg-white"
                        style={{
                          width: `${downloadProgress.percent}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              }

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
                      disabled={!!downloading}
                      className="p-2 rounded-lg hover:bg-[var(--accent-light)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Download"
                    >
                      <Download className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Floating Live Download Indicator Widget */}
      {downloadProgress && downloadProgress.status === 'downloading' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-fade-up">
          <div className="backdrop-blur-xl bg-white/95 dark:bg-neutral-950/90 text-slate-900 dark:text-white p-4 rounded-2xl border border-slate-200 dark:border-white/15 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <p className="text-xs font-medium truncate max-w-[200px] text-slate-700 dark:text-neutral-200">
                  {downloadProgress.filename}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {downloadProgress.percent}%
                </span>
                <button
                  onClick={cancelDownload}
                  className="text-neutral-400 hover:text-white transition-colors p-1"
                  title="Cancel download"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Progress track */}
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${downloadProgress.percent}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1 text-emerald-400 font-mono font-medium">
                <Activity className="w-3 h-3" />
                {downloadProgress.speed}
              </span>
              <span>
                {formatBytes(BigInt(downloadProgress.loaded))} / {formatBytes(BigInt(downloadProgress.total))}
              </span>
              {downloadProgress.eta && <span className="text-amber-400">{downloadProgress.eta}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
