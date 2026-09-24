'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, X, FileIcon, Clock, Download, Lock, Loader2, FileText, Image, Film, Music, Archive, Camera } from 'lucide-react';
import { CONFIG, formatBytes } from '@/lib/config';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return Archive;
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document')) return FileText;
  return FileIcon;
}

interface StagedFile {
  file: File;
  id: string;
  preview?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setFiles([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  // Support pasting screenshots directly from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
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
  }, [addFiles]);

  const handleUpload = async () => {
    if (files.length === 0) { toast.error('Select at least one file'); return; }
    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Request pre-signed upload URLs from Filebase S3 endpoint
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

      if (!presignRes.ok) {
        const errorData = await presignRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to prepare upload');
      }

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

      // Step 2: Direct upload to Filebase via PUT using pre-signed URLs with progress tracking
      const fileBytesLoaded: number[] = new Array(files.length).fill(0);
      const totalBytes = files.reduce((s, f) => s + f.file.size, 0);

      const updateOverallProgress = (index: number, loaded: number) => {
        fileBytesLoaded[index] = loaded;
        const totalLoaded = fileBytesLoaded.reduce((a, b) => a + b, 0);
        const percent = totalBytes > 0 ? (totalLoaded / totalBytes) * 90 : 50;
        setProgress(percent);
      };

      try {
        await Promise.all(
          presignData.files.map((p, index) => {
            const staged = files[index];
            return new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', p.presignedUrl);
              xhr.setRequestHeader('Content-Type', staged.file.type || 'application/octet-stream');

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  updateOverallProgress(index, event.loaded);
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  updateOverallProgress(index, staged.file.size);
                  resolve();
                } else {
                  reject(new Error(`Storage PUT failed with status ${xhr.status}`));
                }
              };

              xhr.onerror = () => reject(new Error('Network error uploading to storage'));
              xhr.send(staged.file);
            });
          })
        );
      } catch (directUploadErr) {
        console.warn('Direct Filebase upload failed, trying server-side proxy fallback:', directUploadErr);
        // Fallback to server route if direct bucket PUT is blocked (e.g., local dev without bucket CORS)
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        if (password) formData.append('password', password);
        formData.append('expiresInSeconds', expiresIn.toString());
        formData.append('maxDownloads', maxDownloads.toString());
        files.forEach(f => formData.append('files', f.file));

        const fallbackRes = await fetch('/api/shares', { method: 'POST', body: formData });
        if (!fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          throw new Error(fallbackData.error || 'Upload failed');
        }
        const fallbackData = await fallbackRes.json();
        setProgress(100);
        toast.success('Files uploaded successfully!');
        setTimeout(() => router.push(`/upload/success/${fallbackData.shareCode}`), 500);
        return;
      }

      // Step 3: Complete registration in database
      setProgress(95);
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
      setProgress(100);
      toast.success('Files uploaded successfully to Filebase!');

      setTimeout(() => {
        router.push(`/upload/success/${completeData.shareCode}`);
      }, 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Upload Files</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Select files to create a secure share link</p>
      </div>

      {/* Dropzone */}
      <div
        className={`dropzone mb-6 ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{ background: 'var(--accent-light)' }}>
          <Upload className="w-8 h-8" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="text-center">
          <p className="font-semibold mb-1">Drag & drop files here</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            or <span className="underline font-medium" style={{ color: 'var(--accent)' }}>browse files</span> • Max {formatBytes(CONFIG.MAX_FILE_SIZE)} per file
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-[var(--border-primary)] bg-[var(--bg-card)] mt-2">
            <Camera className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Tip: Press <kbd className="font-mono bg-[var(--bg-secondary)] px-1 rounded border border-[var(--border-secondary)]">Ctrl+V</kbd> to paste screenshots directly</span>
          </div>
        </div>
      </div>

      {/* Staged Files */}
      {files.length > 0 && (
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">{files.length} file{files.length > 1 ? 's' : ''} • {formatBytes(totalSize)}</span>
            <button onClick={clearAll} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>Clear all</button>
          </div>
          <div className="space-y-2">
            {files.map((f) => {
              const Icon = getFileIcon(f.file.type);
              return (
                <div key={f.id} className="file-card group animate-scale-in">
                  {f.preview ? (
                    <img src={f.preview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                      <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatBytes(f.file.size)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share Options */}
      {files.length > 0 && (
        <div className="glass-card p-6 mb-8 space-y-5 animate-fade-up">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            Share Settings
          </h3>

          <div>
            <label className="block text-sm font-medium mb-1.5">Title <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Project Documents" className="input" maxLength={255} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add a note for the recipient" className="input min-h-[80px] resize-y" maxLength={2000} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> Expiration
              </label>
              <select value={expiresIn} onChange={e => setExpiresIn(Number(e.target.value))} className="input">
                {CONFIG.EXPIRATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Download className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> Download Limit
              </label>
              <select value={maxDownloads} onChange={e => setMaxDownloads(Number(e.target.value))} className="input">
                {CONFIG.DOWNLOAD_LIMIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> Password Protection <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave empty for no password" className="input" maxLength={128} />
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Uploading...</span>
            <span className="text-sm font-mono" style={{ color: 'var(--accent)' }}>{Math.round(progress)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button onClick={handleUpload} disabled={uploading} className="btn-primary w-full py-4 text-base">
          {uploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="w-5 h-5" /> Create Share ({files.length} file{files.length > 1 ? 's' : ''} • {formatBytes(totalSize)})</>
          )}
        </button>
      )}
    </div>
  );
}
