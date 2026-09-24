'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, FileIcon, Clock, Download, Lock, Loader2,
  FileText, Image, Film, Music, Archive, Camera, Activity, CheckCircle2
} from 'lucide-react';
import { CONFIG, formatBytes } from '@/lib/config';

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

interface StagedFile {
  file: File;
  id: string;
  preview?: string;
}

interface UploadProgressState {
  loaded: number;
  total: number;
  percent: number;
  speed: string;
  speedBytes: number;
  eta: string;
  phase: 'preparing' | 'uploading' | 'finalizing' | 'completed';
  fileProgress: Record<string, number>; // staged file id -> percent
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);

  const activeXhrsRef = useRef<XMLHttpRequest[]>([]);

  // Share options
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState(86400);
  const [maxDownloads, setMaxDownloads] = useState(0);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const currentCount = files.length;

    if (currentCount + fileArray.length > CONFIG.MAX_FILES_PER_SHARE) {
      toast.error(`Maximum ${CONFIG.MAX_FILES_PER_SHARE} files per share`);
      return;
    }

    const totalSize = [...files, ...fileArray.map(f => ({ file: f }))].reduce((s, f) => s + ('file' in f ? f.file.size : 0), 0);
    if (totalSize > CONFIG.MAX_TOTAL_SHARE_SIZE) {
      toast.error(`Total size exceeds ${formatBytes(CONFIG.MAX_TOTAL_SHARE_SIZE)} limit`);
      return;
    }

    const staged: StagedFile[] = fileArray
      .filter(f => {
        if (f.size > CONFIG.MAX_FILE_SIZE) {
          toast.error(`"${f.name}" exceeds ${formatBytes(CONFIG.MAX_FILE_SIZE)} limit`);
          return false;
        }
        return true;
      })
      .map(f => ({
        file: f,
        id: Math.random().toString(36).slice(2),
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      }));

    setFiles(prev => [...prev, ...staged]);
  }, [files]);

  const removeFile = (id: string) => {
    if (uploading) return;
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    if (uploading) return;
    files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setFiles([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  // Support pasting screenshots directly from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploading) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (items) {
        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const now = new Date();
              const dateStr = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
              const ext = file.type.split('/')[1] || 'png';
              const namedFile = new File([file], `screenshot-${dateStr}.${ext}`, { type: file.type });
              imageFiles.push(namedFile);
            }
          }
        }
        if (imageFiles.length > 0) {
          e.preventDefault();
          addFiles(imageFiles);
          toast.success(`Added ${imageFiles.length} screenshot${imageFiles.length > 1 ? 's' : ''} from clipboard! 📸`);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles, uploading]);

  const cancelUpload = useCallback(() => {
    activeXhrsRef.current.forEach(xhr => {
      try { xhr.abort(); } catch {}
    });
    activeXhrsRef.current = [];
    setUploading(false);
    setUploadProgress(null);
    toast.info('Upload cancelled');
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) { toast.error('Select at least one file'); return; }
    setUploading(true);

    const totalBytes = files.reduce((s, f) => s + f.file.size, 0);
    const initialFileProgress: Record<string, number> = {};
    files.forEach(f => { initialFileProgress[f.id] = 0; });

    setUploadProgress({
      loaded: 0,
      total: totalBytes,
      percent: 0,
      speed: 'Connecting...',
      speedBytes: 0,
      eta: '',
      phase: 'preparing',
      fileProgress: initialFileProgress,
    });

    const uploadViaServer = async (startSpeed: number = 0) => {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      if (password) formData.append('password', password);
      formData.append('expiresInSeconds', expiresIn.toString());
      formData.append('maxDownloads', maxDownloads.toString());
      files.forEach(f => formData.append('files', f.file));

      setUploadProgress(prev => ({
        loaded: prev?.loaded || 0,
        total: totalBytes,
        percent: prev?.percent || 5,
        speed: prev?.speed || 'Connecting...',
        speedBytes: startSpeed,
        eta: '',
        phase: 'uploading',
        fileProgress: prev?.fileProgress || initialFileProgress,
      }));

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeXhrsRef.current = [xhr];
        xhr.open('POST', '/api/shares');

        let fbLastTime = performance.now();
        let fbLastLoaded = 0;
        let fbSpeedEma = startSpeed;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const now = performance.now();
            const elapsed = (now - fbLastTime) / 1000;
            if (elapsed >= 0.15 || event.loaded === event.total) {
              const delta = event.loaded - fbLastLoaded;
              const instantSpeed = elapsed > 0 ? delta / elapsed : 0;
              fbSpeedEma = fbSpeedEma === 0 ? instantSpeed : fbSpeedEma * 0.7 + instantSpeed * 0.3;
              fbLastTime = now;
              fbLastLoaded = event.loaded;

              const pct = Math.min(95, Math.round((event.loaded / event.total) * 92));
              const rem = Math.max(0, event.total - event.loaded);

              setUploadProgress({
                loaded: event.loaded,
                total: event.total,
                percent: pct,
                speed: formatSpeed(fbSpeedEma),
                speedBytes: fbSpeedEma,
                eta: formatETA(rem, fbSpeedEma),
                phase: 'uploading',
                fileProgress: { ...initialFileProgress },
              });
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const fallbackData = JSON.parse(xhr.responseText);
              setUploadProgress({
                loaded: totalBytes,
                total: totalBytes,
                percent: 100,
                speed: formatSpeed(fbSpeedEma),
                speedBytes: fbSpeedEma,
                eta: 'Complete',
                phase: 'completed',
                fileProgress: {},
              });
              toast.success('Files uploaded successfully!');
              setTimeout(() => router.push(`/upload/success/${fallbackData.shareCode}`), 600);
              resolve();
            } catch {
              reject(new Error('Invalid server response'));
            }
          } else {
            try {
              const errJson = JSON.parse(xhr.responseText);
              reject(new Error(errJson.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error uploading to server'));
        xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
        xhr.send(formData);
      });
    };

    try {
      let directS3Success = false;
      let lastSpeedEma = 0;

      // Attempt direct S3 pre-signed upload first
      try {
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: files.map(f => ({
              filename: f.file.name,
              fileSize: f.file.size,
              mimeType: f.file.type || 'application/octet-stream',
            })),
          }),
        });

        if (presignRes.ok) {
          const presignData: {
            shareCode: string;
            files: Array<{
              presignedUrl: string;
              fileKey: string;
              filename: string;
              fileSize: number;
              mimeType: string;
            }>;
          } = await presignRes.json();

          const fileBytesLoaded: number[] = new Array(files.length).fill(0);
          const currentFileProgress: Record<string, number> = { ...initialFileProgress };

          let lastTime = performance.now();
          let lastLoaded = 0;
          let speedEma = 0;

          setUploadProgress(prev => prev ? { ...prev, phase: 'uploading' } : null);

          const uploadPromises = presignData.files.map((p, index) => {
            const staged = files[index];
            return new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              activeXhrsRef.current.push(xhr);
              xhr.open('PUT', p.presignedUrl);
              xhr.setRequestHeader('Content-Type', p.mimeType || staged.file.type || 'application/octet-stream');

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  fileBytesLoaded[index] = event.loaded;
                  const filePct = staged.file.size > 0 ? Math.min(100, Math.round((event.loaded / staged.file.size) * 100)) : 100;
                  currentFileProgress[staged.id] = filePct;

                  const currentTotalLoaded = fileBytesLoaded.reduce((a, b) => a + b, 0);
                  const now = performance.now();
                  const elapsed = (now - lastTime) / 1000;

                  if (elapsed >= 0.15 || currentTotalLoaded === totalBytes) {
                    const deltaBytes = currentTotalLoaded - lastLoaded;
                    const instantSpeed = elapsed > 0 ? deltaBytes / elapsed : 0;
                    speedEma = speedEma === 0 ? instantSpeed : speedEma * 0.7 + instantSpeed * 0.3;
                    lastSpeedEma = speedEma;
                    lastTime = now;
                    lastLoaded = currentTotalLoaded;

                    const rawPct = totalBytes > 0 ? (currentTotalLoaded / totalBytes) : 0;
                    const overallPct = Math.min(95, Math.round(rawPct * 92));
                    const remainingBytes = Math.max(0, totalBytes - currentTotalLoaded);
                    const eta = speedEma > 0 && remainingBytes > 0 ? formatETA(remainingBytes, speedEma) : '';

                    setUploadProgress({
                      loaded: currentTotalLoaded,
                      total: totalBytes,
                      percent: overallPct,
                      speed: formatSpeed(speedEma),
                      speedBytes: speedEma,
                      eta,
                      phase: 'uploading',
                      fileProgress: { ...currentFileProgress },
                    });
                  }
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  fileBytesLoaded[index] = staged.file.size;
                  currentFileProgress[staged.id] = 100;
                  resolve();
                } else {
                  reject(new Error(`Storage PUT failed with status ${xhr.status}`));
                }
              };

              xhr.onerror = () => reject(new Error('Network error uploading to storage'));
              xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
              xhr.send(staged.file);
            });
          });

          await Promise.all(uploadPromises);

          // Complete registration in database
          setUploadProgress(prev => prev ? {
            ...prev,
            percent: 96,
            phase: 'finalizing',
            eta: 'Finalizing...',
          } : null);

          const completeRes = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shareCode: presignData.shareCode,
              title,
              description,
              password: password || undefined,
              expiresInSeconds: expiresIn,
              maxDownloads,
              files: presignData.files.map(p => ({
                fileKey: p.fileKey,
                originalFilename: p.filename,
                mimeType: p.mimeType,
                fileSize: p.fileSize,
              })),
            }),
          });

          if (!completeRes.ok) {
            const completeData = await completeRes.json().catch(() => ({}));
            throw new Error(completeData.error || 'Failed to complete share registration');
          }

          const completeData = await completeRes.json();
          setUploadProgress(prev => prev ? {
            ...prev,
            percent: 100,
            speed: formatSpeed(speedEma),
            eta: 'Complete',
            phase: 'completed',
          } : null);

          toast.success('Files uploaded successfully!');
          directS3Success = true;

          setTimeout(() => {
            router.push(`/upload/success/${completeData.shareCode}`);
          }, 600);
        }
      } catch (directErr: any) {
        if (directErr?.name === 'AbortError') return;
        console.warn('Direct S3 upload unavailable or rejected, switching to resilient server pipeline:', directErr);
      }

      if (!directS3Success) {
        await uploadViaServer(lastSpeedEma);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : 'Upload failed');
      setUploadProgress(null);
    } finally {
      activeXhrsRef.current = [];
      setUploading(false);
    }
  };

  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
      <div className="text-center mb-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider bg-neutral-100 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 mb-1">
          <Upload className="w-3.5 h-3.5" />
          <span>High-Speed Secure Bridge</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Upload Files
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Stage multiple files, configure end-to-end expiration and download limits, and share with a unique secure token.
        </p>
      </div>

      {/* Dropzone */}
      <div
        className={`dropzone mb-8 ${dragOver ? 'drag-over' : ''} ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 shadow-sm">
          <Upload className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-base text-neutral-900 dark:text-white">Drag & drop files here</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            or <span className="underline font-semibold text-neutral-900 dark:text-neutral-200 cursor-pointer">browse files from device</span> • Max {formatBytes(CONFIG.MAX_FILE_SIZE)} per file
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-white/10 bg-neutral-100/70 dark:bg-white/[0.04] mt-2">
            <Camera className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span>Tip: Press <kbd className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-300 dark:border-white/10 text-neutral-800 dark:text-neutral-200">Ctrl+V</kbd> to paste screenshots directly</span>
          </div>
        </div>
      </div>

      {/* Staged Files */}
      {files.length > 0 && (
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {files.length} file{files.length > 1 ? 's' : ''} staged • <span className="text-neutral-900 dark:text-neutral-200 font-mono">{formatBytes(totalSize)}</span>
            </span>
            {!uploading && (
              <button onClick={clearAll} className="text-xs font-semibold text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer">
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-2.5">
            {files.map((f) => {
              const Icon = getFileIcon(f.file.type);
              const filePct = uploadProgress?.fileProgress?.[f.id];

              return (
                <div key={f.id} className="file-card group animate-scale-in flex-col items-stretch">
                  <div className="flex items-center gap-4 w-full">
                    {f.preview ? (
                      <img src={f.preview} alt="" className="w-11 h-11 rounded-xl object-cover border border-white/15 shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate text-neutral-900 dark:text-white">{f.file.name}</p>
                        {uploading && filePct !== undefined && (
                          filePct >= 100 ? (
                            <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                            </span>
                          ) : (
                            <span className="text-neutral-900 dark:text-neutral-200 font-mono text-xs font-bold shrink-0">
                              {filePct}%
                            </span>
                          )
                        )}
                      </div>
                      <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">{formatBytes(f.file.size)}</p>
                    </div>
                    {!uploading && (
                      <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition-all cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Individual file progress bar during upload */}
                  {uploading && filePct !== undefined && (
                    <div className="w-full h-1.5 bg-neutral-200 dark:bg-white/[0.08] rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-150 bg-neutral-900 dark:bg-white"
                        style={{
                          width: `${filePct}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share Options */}
      {files.length > 0 && !uploading && (
        <div className="glass-card p-6 md:p-8 mb-8 space-y-6 animate-fade-up">
          <div className="flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">Share Settings</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Configure expiration, download limits, and password</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Title <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Project Documents" className="input" maxLength={255} />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Description <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add a note for the recipient" className="input min-h-[80px] resize-y" maxLength={2000} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Expiration
                </label>
                <select value={expiresIn} onChange={e => setExpiresIn(Number(e.target.value))} className="input cursor-pointer">
                  {CONFIG.EXPIRATION_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-neutral-950 text-white">{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-cyan-400" /> Download Limit
                </label>
                <select value={maxDownloads} onChange={e => setMaxDownloads(Number(e.target.value))} className="input cursor-pointer">
                  {CONFIG.DOWNLOAD_LIMIT_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-neutral-950 text-white">{o.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" /> Password Protection <span className="text-neutral-400 font-normal lowercase">(optional)</span>
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave empty for no password" className="input" maxLength={128} />
            </div>
          </div>
        </div>
      )}

      {/* Main Upload Progress Card */}
      {uploading && uploadProgress && (
        <div className="glass-card p-6 md:p-8 mb-6 border border-neutral-200 dark:border-white/10 shadow-2xl animate-fade-up space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200">
                {uploadProgress.phase === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-scale-in" />
                ) : (
                  <Activity className="w-5 h-5 animate-pulse text-neutral-400" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {uploadProgress.phase === 'preparing' && 'Preparing upload...'}
                  {uploadProgress.phase === 'uploading' && 'Transferring files...'}
                  {uploadProgress.phase === 'finalizing' && 'Finalizing secure share...'}
                  {uploadProgress.phase === 'completed' && 'Transfer Complete!'}
                </h4>
                <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  {formatBytes(uploadProgress.loaded)} of {formatBytes(uploadProgress.total)} sent
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {uploadProgress.percent}%
              </span>
              <button
                onClick={cancelUpload}
                className="p-2 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Cancel upload"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-150 bg-neutral-900 dark:bg-white"
              style={{
                width: `${uploadProgress.percent}%`,
              }}
            />
          </div>

          {/* Live Net Speed & Meta Info */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono font-bold">{uploadProgress.speed}</span>
              <span className="text-neutral-500 font-normal">• Net Upload Speed</span>
            </div>

            {uploadProgress.eta && (
              <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{uploadProgress.eta}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && !uploading && (
        <button onClick={handleUpload} className="btn-primary w-full py-3.5 text-sm font-semibold tracking-normal">
          <Upload className="w-4 h-4" />
          Create Share ({files.length} file{files.length > 1 ? 's' : ''} • {formatBytes(totalSize)})
        </button>
      )}

      {/* Floating Live Upload Indicator Widget */}
      {uploading && uploadProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-fade-up">
          <div className="backdrop-blur-xl bg-neutral-950/90 text-white p-4 rounded-2xl border border-white/15 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <p className="text-xs font-medium truncate max-w-[200px] text-neutral-200">
                  Sending {files.length} file{files.length > 1 ? 's' : ''}...
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {uploadProgress.percent}%
                </span>
                <button
                  onClick={cancelUpload}
                  className="text-neutral-400 hover:text-white transition-colors p-1"
                  title="Cancel upload"
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
                  width: `${uploadProgress.percent}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1 text-emerald-400 font-mono font-medium">
                <Activity className="w-3 h-3" />
                {uploadProgress.speed}
              </span>
              <span>
                {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
              </span>
              {uploadProgress.eta && <span className="text-amber-400">{uploadProgress.eta}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
