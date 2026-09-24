'use client';

import React, { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  FolderCode,
  UploadCloud,
  FileCode,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Send,
  ArrowRight,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Info,
  Lock,
  FileCheck,
  RefreshCw,
  FolderArchive,
  ChevronRight,
  Loader2,
  Timer,
  Clock,
} from 'lucide-react';


import {
  DEFAULT_EXCLUSION_RULES,
  ExclusionRule,
  analyzeWorkspaceFiles,
  WorkspaceAnalysisResult,
} from '@/lib/workspace/exclusions';
import { checkSensitiveFile } from '@/lib/workspace/sensitive';
import { categorizeFile, getCategoryBadge } from '@/lib/workspace/categories';
import { analyzeProjectHealth, ProjectHealthReport } from '@/lib/workspace/health';
import SendToDeviceModal from '@/components/send-to-device-modal';
import { toast } from 'sonner';

interface SensitiveFileItem {
  file: File;
  relativePath: string;
  reason: string;
  included: boolean;
}

export default function CodeDropPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phases: 'idle' | 'analyzing' | 'reviewed' | 'uploading' | 'completed'
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'reviewed' | 'uploading' | 'completed'>('idle');

  // Analysis state
  const [projectName, setProjectName] = useState('');
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [activeExclusionRules, setActiveExclusionRules] = useState<ExclusionRule[]>(DEFAULT_EXCLUSION_RULES);
  const [analysis, setAnalysis] = useState<WorkspaceAnalysisResult | null>(null);
  const [health, setHealth] = useState<ProjectHealthReport | null>(null);
  const [sensitiveFiles, setSensitiveFiles] = useState<SensitiveFileItem[]>([]);
  const [showExclusionModal, setShowExclusionModal] = useState(false);

  const [analyzingCount, setAnalyzingCount] = useState(0);

  // Upload progress state
  const [uploadStats, setUploadStats] = useState({
    totalFiles: 0,
    uploadedFiles: 0,
    totalBytes: 0,
    uploadedBytes: 0,
    percent: 0,
    speedBps: 0,
    currentFile: '',
    etaSeconds: 0,
  });

  // Completed workspace state
  const [completedWorkspaceId, setCompletedWorkspaceId] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format reverse countdown timer MM:SS
  const formatTimer = (seconds: number) => {
    const s = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    setRawFiles(filesArray);
    processFiles(filesArray, activeExclusionRules);
  };

  const processFiles = (files: File[], rules: ExclusionRule[]) => {
    setAnalyzingCount(files.length);
    setPhase('analyzing');

    // Instant static processing without delay
    setTimeout(() => {
      // 1. Run exclusion engine immediately
      const analysisResult = analyzeWorkspaceFiles(files, rules);
      setAnalysis(analysisResult);

      // Guess project name from root folder
      const samplePath = files[0]?.webkitRelativePath || files[0]?.name || 'my-project';
      const rootFolder = samplePath.split('/')[0] || 'developer-workspace';
      setProjectName(rootFolder);

      // 2. Identify sensitive files among included files
      const detectedSensitive: SensitiveFileItem[] = [];
      const inspectedIncluded = analysisResult.includedFiles.map((f) => {
        const sens = checkSensitiveFile(f.relativePath);
        if (sens.isSensitive) {
          detectedSensitive.push({
            file: f.file,
            relativePath: f.relativePath,
            reason: sens.matchedRule?.description || 'Contains sensitive keys or credentials',
            included: true, // User can toggle
          });
        }
        return {
          path: f.relativePath,
          size: f.size,
          category: categorizeFile(f.relativePath),
          isSensitive: sens.isSensitive,
        };
      });

      setSensitiveFiles(detectedSensitive);

      // 3. Static Project Health
      const healthReport = analyzeProjectHealth(inspectedIncluded, analysisResult.excludedCount);
      setHealth(healthReport);

      // Transition immediately to reviewed screen
      setPhase('reviewed');
    }, 60);
  };



  const toggleSensitiveFile = (index: number) => {
    setSensitiveFiles((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, included: !item.included } : item))
    );
  };

  const toggleRule = (ruleId: string) => {
    const updated = activeExclusionRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    setActiveExclusionRules(updated);
    if (rawFiles.length > 0) {
      processFiles(rawFiles, updated);
    }
  };

  // Execute Upload
  const startUpload = async () => {
    if (!session) {
      toast.error('Please sign in to upload developer workspaces.');
      router.push('/login?callbackUrl=/codedrop');
      return;
    }

    if (!analysis || analysis.includedFiles.length === 0) {
      toast.error('No files to upload.');
      return;
    }

    // Excluded sensitive files
    const excludedSensitivePaths = new Set(
      sensitiveFiles.filter((s) => !s.included).map((s) => s.relativePath)
    );

    const finalFilesToUpload = analysis.includedFiles.filter(
      (f) => !excludedSensitivePaths.has(f.relativePath)
    );

    if (finalFilesToUpload.length === 0) {
      toast.error('All files were excluded. Nothing to upload.');
      return;
    }

    setPhase('uploading');

    const totalBytes = finalFilesToUpload.reduce((acc, f) => acc + f.size, 0);
    setUploadStats({
      totalFiles: finalFilesToUpload.length,
      uploadedFiles: 0,
      totalBytes,
      uploadedBytes: 0,
      percent: 0,
      speedBps: 0,
      currentFile: 'Requesting secure upload authorization...',
      etaSeconds: 0,
    });


    try {
      // 1. Presign upload URLs
      const presignPayload = {
        workspaceName: projectName,
        files: finalFilesToUpload.map((f) => {
          const isSens = sensitiveFiles.some((s) => s.relativePath === f.relativePath && s.included);
          return {
            relativePath: f.relativePath,
            fileName: f.file.name,
            fileSize: f.size,
            mimeType: f.file.type || 'application/octet-stream',
            category: categorizeFile(f.relativePath),
            isSensitive: isSens,
          };
        }),
      };

      const presignRes = await fetch('/api/workspaces/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presignPayload),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to authorize workspace upload.');
      }

      const presignData = await presignRes.json();
      const filesWithUrls = presignData.files;

      // 2. High-speed concurrent upload worker pool (12 workers)
      const CONCURRENCY = 12;

      let loadedBytes = 0;
      let completedCount = 0;
      let lastTime = performance.now();
      let lastLoaded = 0;

      const uploadQueue = [...finalFilesToUpload.map((item, idx) => ({ item, meta: filesWithUrls[idx] }))];
      const completedFiles: any[] = [];

      const worker = async () => {
        while (uploadQueue.length > 0) {
          const task = uploadQueue.shift();
          if (!task) break;

          const { item, meta } = task;
          setUploadStats((prev) => ({
            ...prev,
            currentFile: item.relativePath,
          }));

          await new Promise<void>((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('fileKey', meta.fileKey);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/workspaces/upload-file');

            let previousFileLoaded = 0;

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const delta = evt.loaded - previousFileLoaded;
                previousFileLoaded = evt.loaded;
                loadedBytes += delta;

                const now = performance.now();
                const timeDiff = (now - lastTime) / 1000;
                let speed = 0;
                if (timeDiff >= 0.3) {
                  speed = (loadedBytes - lastLoaded) / timeDiff;
                  lastLoaded = loadedBytes;
                  lastTime = now;
                }

                const bytePercent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
                const filePercent = Math.round((completedCount / finalFilesToUpload.length) * 100);
                const currentPercent = Math.min(99, Math.max(bytePercent, filePercent));
                const remainingBytes = Math.max(0, totalBytes - loadedBytes);
                const currentEta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

                setUploadStats((prev) => ({
                  ...prev,
                  uploadedBytes: loadedBytes,
                  percent: Math.max(prev.percent, currentPercent),
                  speedBps: speed > 0 ? speed : prev.speedBps,
                  etaSeconds: currentEta > 0 ? currentEta : prev.etaSeconds,
                }));
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                completedCount++;
                completedFiles.push({
                  relativePath: meta.relativePath,
                  fileName: meta.fileName,
                  fileSize: meta.fileSize,
                  mimeType: meta.mimeType,
                  category: meta.category,
                  isSensitive: meta.isSensitive,
                  s3Key: meta.fileKey,
                });

                const filePercent = Math.round((completedCount / finalFilesToUpload.length) * 100);
                const bytePercent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : filePercent;
                const currentPercent = Math.min(99, Math.max(filePercent, bytePercent));

                setUploadStats((prev) => ({
                  ...prev,
                  uploadedFiles: completedCount,
                  percent: Math.max(prev.percent, currentPercent),
                  etaSeconds: completedCount === finalFilesToUpload.length ? 0 : prev.etaSeconds,
                }));
                resolve();
              } else {


                try {
                  const errRes = JSON.parse(xhr.responseText);
                  reject(new Error(errRes.error || `Upload failed for ${item.relativePath}`));
                } catch {
                  reject(new Error(`Upload failed for ${item.relativePath} (${xhr.status})`));
                }
              }
            };

            xhr.onerror = () => {
              reject(new Error(`Network error uploading ${item.relativePath}`));
            };

            xhr.send(formData);
          });
        }
      };


      // Launch worker pool
      const workers = Array.from({ length: Math.min(CONCURRENCY, uploadQueue.length) }, () => worker());
      await Promise.all(workers);

      // 3. Complete workspace registration
      setUploadStats((prev) => ({
        ...prev,
        percent: 100,
        currentFile: 'Saving workspace metadata and static analysis...',
      }));

      const completeRes = await fetch('/api/workspaces/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: presignData.workspaceId,
          name: projectName,
          description: `${health?.framework || 'Project'} workspace with ${completedFiles.length} files`,
          fileCount: completedFiles.length,
          totalBytes,
          skippedCount: analysis.excludedCount,
          skippedBytes: analysis.excludedBytes,
          skippedReport: analysis.breakdown,
          healthReport: health,
          files: completedFiles,
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to finalize workspace metadata.');
      }

      const completeData = await completeRes.json();
      setCompletedWorkspaceId(completeData.workspace.id);
      setPhase('completed');
      toast.success('Workspace uploaded successfully!');
    } catch (err: any) {
      console.error('CodeDrop upload error:', err);
      toast.error(err.message || 'Workspace upload failed.');
      setPhase('reviewed');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-4 shadow-sm">
          <FolderCode className="w-4 h-4" />
          <span>CodeDrop · Developer Workspace Hub</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-4">
          Drop your local workspace. <br />
          <span className="bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 bg-clip-text text-transparent">
            No ZIPs. No Git commits.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          Transfer your live project across your devices instantly. Smart filters automatically skip{' '}
          <code className="text-cyan-600 dark:text-cyan-400 font-mono">node_modules</code>,{' '}
          <code className="text-cyan-600 dark:text-cyan-400 font-mono">.next</code>, and cache folders while keeping sensitive configuration under your control.
        </p>
      </div>

      {/* PHASE 1: IDLE / DROPZONE */}
      {(phase === 'idle' || phase === 'analyzing') && (
        <div className="max-w-2xl mx-auto">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative border-2 border-dashed border-neutral-300 dark:border-neutral-700/80 hover:border-cyan-500 dark:hover:border-cyan-400 rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:-translate-y-1"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFolderSelect}
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              className="hidden"
            />

            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-teal-500/10 to-transparent flex items-center justify-center border border-cyan-500/30 group-hover:scale-110 transition-transform duration-300">
              {phase === 'analyzing' ? (
                <RefreshCw className="w-10 h-10 text-cyan-500 animate-spin" />
              ) : (
                <UploadCloud className="w-10 h-10 text-cyan-600 dark:text-cyan-400" />
              )}
            </div>

            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {phase === 'analyzing' ? 'Inspecting Workspace Heuristics...' : 'Choose or Drop Project Folder'}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
              Click to select any directory from your machine. Directory hierarchy will be preserved automatically.
            </p>

            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-medium text-sm hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/25">
              <FolderCode className="w-4 h-4" />
              <span>Select Project Directory</span>
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-3 gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Auto-skips dependencies</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Never executes code</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>.env secret warnings</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 1.5: LIVE FOLDER INJECTION SCREEN WITH REVERSE TIMER */}
      {/* PHASE 1.5: FAST DIRECTORY ANALYSIS */}
      {phase === 'analyzing' && (
        <div className="max-w-md mx-auto text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex items-center justify-center animate-pulse">
            <FolderCode className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            Analyzing Project Directory...
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {analyzingCount > 0 ? `Scanning ${analyzingCount.toLocaleString()} files` : 'Scanning files'} and auto-skipping dependencies...
          </p>
        </div>
      )}


      {/* PHASE 2: REVIEW & ANALYSIS SCREEN */}
      {phase === 'reviewed' && analysis && health && (

        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Top Project Summary Card */}
          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Project Workspace
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 bg-transparent border-b border-dashed border-neutral-300 dark:border-neutral-700 focus:border-cyan-500 focus:outline-none px-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExclusionModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-neutral-100/70 dark:bg-neutral-800/70 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-800 dark:text-neutral-200"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Customize Exclusions</span>
                </button>
                <button
                  onClick={() => {
                    setPhase('idle');
                    setRawFiles([]);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
              <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/50 dark:border-cyan-900/30">
                <span className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">Files to Upload</span>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mt-1">
                  {analysis.includedCount.toLocaleString()}
                </p>
                <span className="text-xs text-neutral-500">Essential project files</span>
              </div>

              <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/30">
                <span className="text-xs text-teal-700 dark:text-teal-300 font-medium">Estimated Size</span>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mt-1">
                  {formatBytes(analysis.includedBytes)}
                </p>
                <span className="text-xs text-neutral-500">Uncompressed payload</span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30">
                <span className="text-xs text-rose-700 dark:text-rose-300 font-medium">Excluded Auto</span>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mt-1">
                  {analysis.excludedCount.toLocaleString()}
                </p>
                <span className="text-xs text-neutral-500">{formatBytes(analysis.excludedBytes)} saved</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Sensitive Files</span>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mt-1">
                  {sensitiveFiles.length}
                </p>
                <span className="text-xs text-neutral-500">Require user consent</span>
              </div>
            </div>
          </div>

          {/* SENSITIVE FILES ALERT BANNER */}
          {sensitiveFiles.length > 0 && (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    SENSITIVE FILES DETECTED ({sensitiveFiles.length})
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    These configuration files may contain secret API keys, database credentials, or tokens. Choose whether to include them.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {sensitiveFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-amber-500/20"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-base">🔐</span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 font-mono truncate">
                          {item.relativePath}
                        </p>
                        <p className="text-xs text-neutral-500">{item.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleSensitiveFile(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          item.included
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {item.included ? '✓ Included' : 'Excluded'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROJECT HEALTH CARD (STATIC INSPECTION ONLY) */}
          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Static Project Architecture & Health
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Purely static structural analysis. Zero code execution or package installation.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {health.framework}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  {health.language}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {health.checks.map((chk, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/80"
                >
                  {chk.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {chk.name}
                    </span>
                    <p className="text-xs text-neutral-500">{chk.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Developer File Categories */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-3">
                File Breakdown by Developer Category
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(health.fileStats.categories).map(([cat, count]) => {
                  const badge = getCategoryBadge(cat as any);
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border"
                      style={{ backgroundColor: badge.bg, borderColor: `${badge.color}40`, color: badge.color }}
                    >
                      <span className="capitalize font-bold">{badge.label}:</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SKIPPED FILE REPORT */}
          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    EXCLUDED AUTOMATICALLY ({analysis.excludedCount.toLocaleString()} files)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    These heavy generated folders are skipped to ensure rapid transfer without wasting bandwidth.
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {analysis.breakdown.length === 0 ? (
                <p className="text-xs text-neutral-500 py-3">No files were excluded.</p>
              ) : (
                analysis.breakdown.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {item.name}
                      </span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-neutral-600 dark:text-neutral-400">{item.reason}</span>
                    </div>
                    <div className="flex items-center gap-4 text-neutral-500 font-mono">
                      <span>{item.fileCount.toLocaleString()} files</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {formatBytes(item.totalBytes)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Trigger Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xl">
            <div>
              <p className="text-sm font-bold">Ready to upload {analysis.includedCount} files?</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-600">
                Payload: {formatBytes(analysis.includedBytes)} · Dependencies skipped: {analysis.excludedCount}
              </p>
            </div>
            <button
              onClick={startUpload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-sm shadow-xl shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <UploadCloud className="w-5 h-5" />
              <span>Upload Workspace Now</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: LIVE UPLOADING SCREEN */}
      {phase === 'uploading' && (
        <div className="max-w-2xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-8 sm:p-12 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex items-center justify-center animate-pulse">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-1">
            Uploading Workspace
          </h2>

          {/* Prominent Large Percentage Display */}
          <div className="my-5 flex items-baseline justify-center gap-1.5">
            <span className="text-6xl sm:text-7xl font-black bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent font-mono tracking-tight drop-shadow-sm">
              {uploadStats.percent}
            </span>
            <span className="text-3xl font-bold text-cyan-500 font-mono">%</span>
          </div>

          {/* Progress Bar with Glowing Effect */}
          <div className="w-full bg-neutral-200 dark:bg-neutral-800/90 h-4 rounded-full overflow-hidden mb-5 p-0.5 border border-neutral-300 dark:border-neutral-700 shadow-inner">
            <div
              className="bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-md relative overflow-hidden"
              style={{ width: `${Math.max(2, uploadStats.percent)}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* Real-time stats grid with Reverse Countdown Timer */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/60 mb-5 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800">
              <span className="text-neutral-400 text-[10px] uppercase font-bold block mb-0.5">Speed</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400 text-sm">
                ⚡ {formatBytes(uploadStats.speedBps)}/s
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800">
              <span className="text-neutral-400 text-[10px] uppercase font-bold block mb-0.5">Files</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                {uploadStats.uploadedFiles} / {uploadStats.totalFiles}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800">
              <span className="text-neutral-400 text-[10px] uppercase font-bold block mb-0.5">Uploaded</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                {formatBytes(uploadStats.uploadedBytes)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800">
              <span className="text-neutral-400 text-[10px] uppercase font-bold block mb-0.5">Total Size</span>
              <span className="font-bold text-indigo-500 dark:text-indigo-400 text-sm">
                {formatBytes(uploadStats.totalBytes)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800 col-span-2 sm:col-span-1">
              <span className="text-neutral-400 text-[10px] uppercase font-bold block mb-0.5">Reverse Timer</span>
              <span className="font-bold text-amber-500 text-sm">
                ⏱️ {uploadStats.etaSeconds > 0 ? formatTimer(uploadStats.etaSeconds) : '< 1s'}
              </span>
            </div>
          </div>


          {/* Active File Chip */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 py-2 px-4 rounded-xl max-w-lg mx-auto mb-4 border border-neutral-200 dark:border-neutral-700/50">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500 flex-shrink-0" />
            <span className="truncate">{uploadStats.currentFile}</span>
          </div>

          <p className="text-xs text-neutral-400">
            Direct streaming to encrypted cloud storage. Please keep this tab active.
          </p>
        </div>
      )}


      {/* PHASE 4: COMPLETED SCREEN */}
      {phase === 'completed' && (
        <div className="max-w-2xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-8 sm:p-12 shadow-2xl text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-2">
            Workspace Uploaded!
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto mb-8">
            Your project <strong className="text-neutral-900 dark:text-neutral-100">{projectName}</strong> is safely stored and ready for cross-device transfer or download.
          </p>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 mb-8 text-xs font-mono">
            <div>
              <span className="text-neutral-400 block">Uploaded</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                {uploadStats.totalFiles} files
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">Payload</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                {formatBytes(uploadStats.totalBytes)}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">Skipped</span>
              <span className="font-bold text-rose-500 text-sm">
                {analysis?.excludedCount.toLocaleString()} files
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/workspaces/${completedWorkspaceId}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/25 transition-all"
            >
              <Eye className="w-4 h-4" />
              <span>View Workspace & Files</span>
            </Link>

            <button
              onClick={() => setSendModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white font-bold text-sm transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Send to Device</span>
            </button>

            <button
              onClick={() => {
                setPhase('idle');
                setRawFiles([]);
                setCompletedWorkspaceId(null);
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMIZE EXCLUSIONS MODAL */}
      {showExclusionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-500" />
                <span>Customize Exclusions</span>
              </h3>
              <button
                onClick={() => setShowExclusionModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500 mb-6">
              Enable or disable default exclusion filters. Disabling filters like <code className="font-mono">node_modules</code> may cause thousands of files to upload.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {activeExclusionRules.map((rule) => (
                <label
                  key={rule.id}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                    className="mt-1 rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                        {rule.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-sans">
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{rule.reason}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button
                onClick={() => setShowExclusionModal(false)}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-semibold text-xs hover:bg-cyan-500 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Device Modal */}
      {completedWorkspaceId && (
        <SendToDeviceModal
          isOpen={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          itemTitle={`Workspace: ${projectName}`}
          itemType="workspace"
          itemPayload={{
            workspaceId: completedWorkspaceId,
            projectName,
            fileCount: uploadStats.totalFiles,
            totalBytes: uploadStats.totalBytes,
          }}
        />
      )}
    </div>
  );
}
