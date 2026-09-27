'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  GitCommit,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Terminal,
  Lock,
  ChevronRight,
  X,
  Play,
  Copy,
  Check,
  ArrowUpRight,
  Zap,
  Activity,
  Shield,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  connectedRepo: {
    owner: string;
    repositoryName: string;
    defaultBranch: string;
    lastCommitSha?: string;
  };
  onCommitSuccess: () => void;
}

interface AnalysisData {
  totalFiles: number;
  totalSize: number;
  includedCount: number;
  ignoredCount: number;
  includedSize: number;
  ignoredSize: number;
  includedFiles: Array<any>;
  ignoredFiles: Array<any>;
  ignoredByCategory: Record<
    string,
    {
      category: string;
      name: string;
      fileCount: number;
      totalSize: number;
      reason: string;
      sampleFiles: string[];
    }
  >;
  warnings: string[];
  securityFindings: Array<{ filePath: string; rule: string; reason: string }>;
  hasSecrets: boolean;
  generatedCount: number;
  dependencyCount: number;
  largeFileCount: number;
}

interface CommitResultData {
  commitSha: string;
  commitUrl: string;
  branch: string;
  repository: string;
  filesCommitted: number;
  ignoredCount: number;
  timeTakenMs: number;
  stats?: any;
}

interface CheckRunItem {
  id: number;
  name: string;
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, neutral, etc.
  startedAt: string;
  completedAt?: string;
  htmlUrl?: string;
  output?: { title?: string; summary?: string } | null;
}

export function CommitModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  connectedRepo,
  onCommitSuccess,
}: CommitModalProps) {
  // Step tracker: 'analyze' | 'review' | 'committing' | 'completed' | 'failed'
  const [step, setStep] = useState<'analyze' | 'review' | 'committing' | 'completed' | 'failed'>('analyze');
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [isUpdatingOverrides, setIsUpdatingOverrides] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

  // Commit fields
  const [commitMessage, setCommitMessage] = useState(`Update workspace ${workspaceName} via VaultDrop`);
  const [branch, setBranch] = useState(connectedRepo.defaultBranch || 'main');
  const [userOverrides, setUserOverrides] = useState<string[]>([]);
  const [allowSecretsOverride, setAllowSecretsOverride] = useState(false);

  // Terminal logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);

  // Result & Errors
  const [commitResult, setCommitResult] = useState<CommitResultData | null>(null);
  const [errorDetails, setErrorDetails] = useState<any | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // CI / Check Runs
  const [checkRuns, setCheckRuns] = useState<CheckRunItem[]>([]);
  const [ciStatus, setCiStatus] = useState<'none' | 'pending' | 'running' | 'success' | 'failed'>('none');
  const [pollingCi, setPollingCi] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const addLog = (msg: string) => {
    setTerminalLogs((prev) => [...prev, `> ${msg}`]);
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Core analysis executor
  const executeAnalysis = async (overridesToUse: string[], isInitial = false) => {
    try {
      if (isInitial) {
        setLoadingAnalysis(true);
        setStep('analyze');
        setTerminalLogs([]);
        addLog(`Preparing workspace "${workspaceName}"...`);
        addLog(`Connecting to repository ${connectedRepo.owner}/${connectedRepo.repositoryName}...`);
      } else {
        setIsUpdatingOverrides(true);
      }

      const res = await fetch(`/api/github/workspace/${workspaceId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userOverrides: overridesToUse }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze workspace');
      }

      setAnalysis(data.analysis);

      if (isInitial) {
        addLog(`Scanned ${data.analysis.totalFiles} files (${formatBytes(data.analysis.totalSize)})`);
        addLog(`Applied safety ignore rules: ${data.analysis.ignoredCount} files excluded`);
        addLog(`Included for commit: ${data.analysis.includedCount} files (${formatBytes(data.analysis.includedSize)})`);

        if (data.analysis.hasSecrets) {
          addLog(`⚠ Security alert: ${data.analysis.securityFindings.length} potential secret(s) detected!`);
        } else {
          addLog(`✓ Security check passed: No secret patterns detected.`);
        }

        setStep('review');
      } else {
        addLog(`Updated safety rules: ${data.analysis.ignoredCount} excluded (${data.analysis.includedCount} for commit)`);
        if (!data.analysis.hasSecrets) {
          addLog(`✓ All sensitive files excluded! Security block cleared.`);
        }
      }
    } catch (err: any) {
      addLog(`✕ Analysis error: ${err.message}`);
      toast.error(err?.message || 'Error analyzing workspace');
      if (isInitial) {
        setErrorDetails({
          step: 'Workspace Analysis',
          statusCode: 500,
          errorCode: 'ANALYSIS_FAILED',
          reason: err.message,
          suggestedFix: 'Ensure your workspace files are uploaded and refresh.',
          retryable: true,
        });
        setStep('failed');
      }
    } finally {
      setLoadingAnalysis(false);
      setIsUpdatingOverrides(false);
    }
  };

  // Run initial analysis ONLY when modal opens (never re-runs on prop re-renders or updates)
  useEffect(() => {
    if (isOpen) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        setStep('analyze');
        setTerminalLogs([]);
        setCommitResult(null);
        setErrorDetails(null);
        setUserOverrides([]);
        setAllowSecretsOverride(false);
        setCommitMessage(`Update workspace ${workspaceName} via VaultDrop`);
        setBranch(connectedRepo.defaultBranch || 'main');
        executeAnalysis([], true);
      }
    } else {
      hasInitializedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAutoExcludeSecrets = () => {
    if (!analysis) return;
    const secretPaths = analysis.securityFindings.map((f) => f.filePath);
    const updated = Array.from(new Set([...userOverrides, ...secretPaths]));
    setUserOverrides(updated);
    toast.success(`Excluded ${secretPaths.length} sensitive file(s) from commit`);
    executeAnalysis(updated, false);
  };

  const handleToggleFileOverride = (filePath: string) => {
    const isExcluded = userOverrides.includes(filePath);
    const updated = isExcluded
      ? userOverrides.filter((p) => p !== filePath)
      : [...userOverrides, filePath];
    setUserOverrides(updated);
    executeAnalysis(updated, false);
  };

  // Execute Commit
  const handleExecuteCommit = async () => {
    if (!analysis || step === 'committing' || step === 'completed') return;

    if (analysis.hasSecrets && !allowSecretsOverride) {
      toast.error('Commit stopped: Potential secret detected. Click "Exclude All Sensitive Files" before proceeding.');
      return;
    }

    try {
      setStep('committing');
      addLog(`──────────────────────────────────────────`);
      addLog(`Starting commit to branch "${branch}"...`);
      addLog(`Authenticating with VAULTDROP SYNC GitHub App...`);
      addLog(`Assembling Git tree with ${analysis.includedCount} files...`);

      const res = await fetch(`/api/github/workspace/${workspaceId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitMessage,
          branch,
          allowSecretsOverride,
          userOverrides,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw data;
      }

      const durationSec = (data.timeTakenMs / 1000).toFixed(2);
      addLog(`✓ Git tree assembled: ${data.filesCommitted} files committed`);
      addLog(`✓ Commit created: ${data.commitSha.slice(0, 7)}`);
      addLog(`✓ Updated remote ref: refs/heads/${branch}`);
      addLog(`✓ Pushed successfully to GitHub in ${durationSec}s`);
      addLog(`──────────────────────────────────────────`);
      addLog(`★ COMMIT LIVE: ${connectedRepo.owner}/${connectedRepo.repositoryName}@${branch}`);
      addLog(`SHA: ${data.commitSha}`);
      addLog(`──────────────────────────────────────────`);

      setCommitResult(data);
      setStep('completed');

      // Inform parent quietly so it can refresh background state without unmounting
      try {
        onCommitSuccess();
      } catch (e) {
        console.warn('onCommitSuccess warning:', e);
      }

      // Begin polling CI
      startCiPolling(data.commitSha);
    } catch (err: any) {
      const details = err?.details || {
        step: 'Creating Commit',
        statusCode: err?.status || 500,
        errorCode: 'COMMIT_FAILED',
        reason: err?.error || err?.message || 'Failed to complete commit.',
        suggestedFix: 'Review permissions or verify the target repository.',
        retryable: true,
      };

      addLog(`✕ Commit failed at step "${details.step}": ${details.reason}`);
      setErrorDetails(details);
      setStep('failed');
    }
  };

  // Poll CI check runs after commit
  const startCiPolling = (commitSha: string) => {
    setPollingCi(true);
    addLog(`Waiting for GitHub Actions & CI checks...`);

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(
          `/api/github/commits/${commitSha}?owner=${encodeURIComponent(connectedRepo.owner)}&repo=${encodeURIComponent(connectedRepo.repositoryName)}`
        );
        if (res.ok) {
          const data = await res.json();
          setCheckRuns(data.checkRuns || []);
          setCiStatus(data.overallStatus);

          if (data.overallStatus === 'running') {
            addLog(`● GitHub Actions: Workflow running...`);
          } else if (data.overallStatus === 'success') {
            addLog(`✓ GitHub Actions: All CI checks passed!`);
            clearInterval(interval);
            setPollingCi(false);
          } else if (data.overallStatus === 'failed') {
            addLog(`✕ GitHub Actions: One or more checks failed.`);
            clearInterval(interval);
            setPollingCi(false);
          }
        }
      } catch {}

      if (attempts >= 12) {
        clearInterval(interval);
        setPollingCi(false);
      }
    }, 5000);
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    toast.success('Commit SHA copied to clipboard');
    setTimeout(() => setCopiedSha(false), 2000);
  };

  if (!isOpen) return null;

  const stepConfig = [
    { key: 'analyze', label: 'Analyze', done: !loadingAnalysis },
    { key: 'filter', label: 'Filter', done: step !== 'analyze' },
    { key: 'security', label: 'Security', done: step !== 'analyze' },
    { key: 'commit', label: 'Commit', done: step === 'completed' },
    { key: 'push', label: 'Push', done: step === 'completed' },
    { key: 'ci', label: 'CI', done: ciStatus === 'success' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* ─── Modal Header ─── */}
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 text-sky-500 border border-sky-500/20 flex items-center justify-center">
                <GitCommit className="w-5 h-5" />
              </div>
              {step === 'committing' && (
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sky-500 animate-ping" />
              )}
              {step === 'completed' && (
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Commit to GitHub
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                  {connectedRepo.owner}/{connectedRepo.repositoryName}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Secure Git tree sync with automatic safety filtering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Progress Pipeline ─── */}
        <div className="px-5 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {stepConfig.map((item, i) => {
              const isActive =
                (item.key === 'analyze' && step === 'analyze') ||
                (item.key === 'filter' && step === 'review') ||
                (item.key === 'security' && step === 'review') ||
                (item.key === 'commit' && step === 'committing') ||
                (item.key === 'push' && step === 'committing') ||
                (item.key === 'ci' && step === 'completed' && ciStatus !== 'success');

              return (
                <React.Fragment key={item.key}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300 ${
                        item.done
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? 'bg-sky-500 text-white ring-4 ring-sky-500/20'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                      }`}
                    >
                      {item.done ? (
                        <Check className="w-3 h-3" />
                      ) : isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-semibold whitespace-nowrap ${
                        item.done
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isActive
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {i < stepConfig.length - 1 && (
                    <div
                      className={`w-6 h-px mx-0.5 transition-colors duration-300 ${
                        item.done ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ─── Main Body Grid ─── */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* ── Left Column: Form & Health (7 cols) ── */}
          <div className="lg:col-span-7 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-800 space-y-5 overflow-y-auto">
            {/* Step: Analysis Loading */}
            {loadingAnalysis && (
              <div className="py-16 text-center space-y-4">
                <div className="relative inline-block">
                  <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/15 flex items-center justify-center mx-auto">
                    <RefreshCw className="w-7 h-7 text-sky-500 animate-spin" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Scanning workspace architecture
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Filtering dependencies, generated artifacts, and credentials
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-sky-500"
                      style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step: Review / Ready to Commit */}
            {!loadingAnalysis && analysis && step !== 'completed' && step !== 'failed' && (
              <>
                {/* Project Health Card */}
                <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-800/30 border border-neutral-200/60 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Activity className="w-3 h-3" />
                      Project Health
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Upload: <strong className="text-sky-500">{formatBytes(analysis.includedSize)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700">
                      <span className="text-[10px] text-neutral-400 block mb-0.5">Total Files</span>
                      <span className="text-lg font-extrabold font-mono text-neutral-800 dark:text-neutral-200 leading-none">
                        {analysis.totalFiles}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5">Included</span>
                      <span className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                        {analysis.includedCount}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/8 border border-rose-500/15">
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 block mb-0.5">Excluded</span>
                      <span className="text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 leading-none">
                        {analysis.ignoredCount}
                      </span>
                    </div>
                  </div>

                  {/* Visual bar showing include/exclude ratio */}
                  {analysis.totalFiles > 0 && (
                    <div className="flex items-center gap-1">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(analysis.includedCount / analysis.totalFiles) * 100}%` }}
                      />
                      <div
                        className="h-1.5 rounded-full bg-rose-500/30 transition-all duration-500"
                        style={{ width: `${(analysis.ignoredCount / analysis.totalFiles) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Secret Warning Banner */}
                {analysis.hasSecrets ? (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0 text-rose-500">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-rose-700 dark:text-rose-300 block">
                            Potential Secret Detected!
                          </span>
                          <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                            {analysis.securityFindings.length} sensitive file(s) blocked to protect credentials
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoExcludeSecrets}
                        disabled={isUpdatingOverrides}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow-md shadow-rose-600/20 hover:shadow-rose-600/30 self-start sm:self-auto disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Exclude All Sensitive Files</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 font-mono text-[11px] max-h-40 overflow-y-auto pr-1">
                      {analysis.securityFindings.map((finding, idx) => {
                        const isExcluded = userOverrides.includes(finding.filePath);
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                              isExcluded
                                ? 'bg-neutral-100/50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 mr-2">
                              <Lock className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                              <span className="truncate">{finding.filePath}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                                {finding.rule}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleFileOverride(finding.filePath)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                                  isExcluded
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-rose-500 hover:text-white'
                                }`}
                              >
                                {isExcluded ? 'Excluded ✓' : 'Exclude'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-1 flex items-center justify-between border-t border-rose-500/15">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowSecretsOverride}
                          onChange={(e) => setAllowSecretsOverride(e.target.checked)}
                          className="rounded border-rose-500/30 text-rose-600 focus:ring-rose-500 w-4 h-4"
                        />
                        <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                          Override security block & commit anyway (High Risk)
                        </span>
                      </label>
                      <span className="text-[10px] text-rose-500/70 italic">
                        Excluded files remain safe in VaultDrop
                      </span>
                    </div>
                  </div>
                ) : userOverrides.length > 0 ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>{userOverrides.length} sensitive file(s) excluded from commit. Repository is protected!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserOverrides([]);
                        executeAnalysis([], false);
                      }}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 underline hover:no-underline font-mono"
                    >
                      Reset
                    </button>
                  </div>
                ) : null}

                {/* Ignored Breakdown Accordion */}
                {Object.keys(analysis.ignoredByCategory).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs px-0.5">
                      <span className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-neutral-400" />
                        Excluded from Commit ({analysis.ignoredCount})
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Still preserved in VaultDrop
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                      {Object.entries(analysis.ignoredByCategory).map(([catKey, cat]) => (
                        <div
                          key={catKey}
                          className="rounded-xl border border-neutral-200/60 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 overflow-hidden text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedCategory(expandedCategory === catKey ? null : catKey)}
                            className="w-full p-3 flex items-center justify-between hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="transition-transform duration-200"
                                style={{ transform: expandedCategory === catKey ? 'rotate(90deg)' : 'rotate(0deg)' }}
                              >
                                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                              </div>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                                {cat.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-200/60 dark:bg-neutral-700 text-neutral-500">
                                {cat.fileCount}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono">{formatBytes(cat.totalSize)}</span>
                          </button>

                          {expandedCategory === catKey && (
                            <div className="px-3 pb-3 border-t border-neutral-200/40 dark:border-neutral-800/40 text-[11px] space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                              <p className="text-neutral-500 italic pt-2">{cat.reason}</p>
                              <div className="space-y-0.5 font-mono text-[10px] text-neutral-500">
                                {cat.sampleFiles.map((sf, idx) => (
                                  <div key={idx} className="truncate pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
                                    {sf}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commit Form Controls */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                      Commit Message
                    </label>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Enter commit message..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                        Target Branch
                      </label>
                      <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-800 dark:text-neutral-200">
                        <GitBranch className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                        <input
                          type="text"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="bg-transparent focus:outline-none w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                        Repository
                      </label>
                      <div className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-500 truncate text-[11px]">
                        {connectedRepo.owner}/{connectedRepo.repositoryName}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step: Completed Success State — DEFINITIVE FINAL ANSWER */}
            {step === 'completed' && commitResult && (
              <div className="py-2 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {/* Celebration Hero Card */}
                <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/25 shadow-xl shadow-emerald-500/10">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur animate-pulse -z-10" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Live on GitHub
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {(commitResult.timeTakenMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                        Commit Pushed Successfully!
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        All workspace files are now versioned on branch{' '}
                        <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                          {commitResult.branch}
                        </strong>{' '}
                        in{' '}
                        <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                          {commitResult.repository}
                        </strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Target Repo & Commit SHA Bar */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/80 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        Target Repository
                      </span>
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        <span>{commitResult.repository}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                          {commitResult.branch}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        Commit SHA
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-mono font-bold text-sky-500">
                          {commitResult.commitSha.slice(0, 7)}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopySha(commitResult.commitSha)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
                          title="Copy Full SHA"
                        >
                          {copiedSha ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metric Stat Cards Grid */}
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/15 text-center">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mb-0.5">
                      Committed
                    </span>
                    <span className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                      {commitResult.filesCommitted}
                    </span>
                    <span className="text-[9px] text-neutral-400 block mt-1">files pushed</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/80 text-center">
                    <span className="text-[10px] text-neutral-500 font-semibold block mb-0.5">
                      Protected
                    </span>
                    <span className="text-lg font-extrabold font-mono text-neutral-700 dark:text-neutral-300 leading-none">
                      {commitResult.ignoredCount}
                    </span>
                    <span className="text-[9px] text-neutral-400 block mt-1">excluded</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/80 text-center">
                    <span className="text-[10px] text-neutral-500 font-semibold block mb-0.5">
                      Payload
                    </span>
                    <span className="text-lg font-extrabold font-mono text-neutral-700 dark:text-neutral-300 leading-none">
                      {analysis ? formatBytes(analysis.includedSize) : '2.2 MB'}
                    </span>
                    <span className="text-[9px] text-neutral-400 block mt-1">uploaded</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/80 text-center">
                    <span className="text-[10px] text-neutral-500 font-semibold block mb-0.5">
                      Duration
                    </span>
                    <span className="text-lg font-extrabold font-mono text-neutral-700 dark:text-neutral-300 leading-none">
                      {(commitResult.timeTakenMs / 1000).toFixed(1)}s
                    </span>
                    <span className="text-[9px] text-neutral-400 block mt-1">sync time</span>
                  </div>
                </div>

                {/* CI & GitHub Actions Status Card */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        GitHub Actions & CI Status
                      </span>
                      {pollingCi && <RefreshCw className="w-3 h-3 text-sky-500 animate-spin" />}
                    </div>
                    <span className="text-[11px] font-mono font-bold">
                      {ciStatus === 'running' && (
                        <span className="text-sky-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                          Running Checks
                        </span>
                      )}
                      {ciStatus === 'success' && <span className="text-emerald-500">✓ All Workflows Passed</span>}
                      {ciStatus === 'failed' && <span className="text-rose-500">✕ Checks Failed</span>}
                      {ciStatus === 'none' && <span className="text-neutral-400">No active workflows</span>}
                      {ciStatus === 'pending' && <span className="text-amber-500">Queued...</span>}
                    </span>
                  </div>

                  {checkRuns.length > 0 && (
                    <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto">
                      {checkRuns.map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700"
                        >
                          <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate mr-2">
                            {run.name}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                run.conclusion === 'success'
                                  ? 'text-emerald-500'
                                  : run.conclusion === 'failure'
                                  ? 'text-rose-500'
                                  : 'text-sky-500'
                              }`}
                            >
                              {run.conclusion || run.status}
                            </span>
                            {run.htmlUrl && (
                              <a
                                href={run.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-neutral-400 hover:text-sky-500 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <a
                    href={commitResult.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/35 hover:-translate-y-0.5"
                  >
                    <span>View Commit on GitHub</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3.5 px-6 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 font-bold text-xs transition-all shadow-md hover:-translate-y-0.5"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Step: Failed State with Structured Diagnostics */}
            {step === 'failed' && errorDetails && (
              <div className="py-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="p-5 rounded-2xl bg-rose-500/8 border border-rose-500/15 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <XCircle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-rose-700 dark:text-rose-300 block">
                        Commit Failed
                      </span>
                      <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                        Step: {errorDetails.step}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-700 dark:text-rose-300">
                    <div>
                      <span className="text-neutral-400 text-[10px]">Status: </span>
                      <strong className="text-rose-500">
                        {errorDetails.statusCode || 500} ({errorDetails.errorCode})
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-[10px]">Reason: </span>
                      <span>{errorDetails.reason}</span>
                    </div>
                  </div>

                  {errorDetails.suggestedFix && (
                    <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/15 text-[11px] text-amber-700 dark:text-amber-300">
                      <strong className="flex items-center gap-1.5 mb-0.5">
                        <Zap className="w-3 h-3" />
                        Suggested Fix
                      </strong>
                      <span>{errorDetails.suggestedFix}</span>
                    </div>
                  )}

                  {errorDetails.technicalDetails && (
                    <p className="text-[10px] text-neutral-400 font-mono truncate">
                      Technical: {errorDetails.technicalDetails}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {errorDetails.retryable && (
                    <button
                      onClick={handleExecuteCommit}
                      className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setStep('review');
                      setErrorDetails(null);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Back to Review
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Developer Terminal Log Panel (5 cols) ── */}
          <div className="lg:col-span-5 bg-neutral-950 flex flex-col justify-between font-mono text-xs text-neutral-300">
            {/* Terminal Header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex items-center gap-1.5 ml-1">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Sync Console
                  </span>
                </div>
              </div>
              <span className="text-[9px] text-neutral-700 uppercase tracking-wider">vaultdrop/sync v1.0</span>
            </div>

            {/* Terminal Content */}
            <div
              ref={terminalRef}
              className="flex-1 px-5 py-4 space-y-1 max-h-[380px] overflow-y-auto text-[11px] leading-relaxed scrollbar-thin"
            >
              {terminalLogs.length === 0 ? (
                <p className="text-neutral-600 italic">Waiting to begin workspace sync...</p>
              ) : (
                terminalLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`break-words transition-opacity duration-200 ${
                      log.includes('✕')
                        ? 'text-rose-400'
                        : log.includes('✓') || log.includes('★')
                        ? 'text-emerald-400 font-semibold'
                        : log.includes('⚠')
                        ? 'text-amber-400'
                        : log.includes('●')
                        ? 'text-sky-400'
                        : log.includes('──')
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
              {step === 'committing' && (
                <div className="flex items-center gap-2 text-sky-400 pt-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                  <span>Pushing Git tree & updating branch ref...</span>
                </div>
              )}
            </div>

            {/* Commit Trigger Button in footer */}
            {step === 'review' && (
              <div className="px-5 py-4 border-t border-neutral-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-neutral-500 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCommit}
                  disabled={loadingAnalysis || (analysis?.hasSecrets && !allowSecretsOverride)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2 ${
                    analysis?.hasSecrets && !allowSecretsOverride
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                      : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-sky-500/20 hover:-translate-y-0.5'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Commit to GitHub</span>
                </button>
              </div>
            )}

            {step === 'completed' && (
              <div className="px-5 py-4 border-t border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Sync Complete</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 transition-colors"
                >
                  Close Console
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
