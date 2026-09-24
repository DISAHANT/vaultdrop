import Link from 'next/link';
import {
  FolderCode,
  Laptop,
  Clipboard,
  Radio,
  Upload,
  Download,
  Shield,
  Clock,
  Lock,
  QrCode,
  ArrowRight,
  Zap,
  Layers,
  Cpu,
  CheckCircle2,
  Send,
  Eye,
  Terminal,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative overflow-hidden min-h-screen">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-12 left-1/3 w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-25 blur-3xl bg-cyan-500" />
        <div className="absolute top-48 right-1/4 w-[450px] h-[450px] rounded-full opacity-15 dark:opacity-20 blur-3xl bg-indigo-500" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 md:pt-36 md:pb-28 px-4 sm:px-6 max-w-7xl mx-auto z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-8 shadow-sm">
          <Shield className="w-3.5 h-3.5" />
          <span>Cross-Device Bridge · Files, Clipboard & CodeDrop</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-neutral-900 dark:text-white max-w-4xl mx-auto mb-6">
          Your personal bridge <br />
          <span className="bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 bg-clip-text text-transparent">
            between your devices.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Move files, clipboard content and project workspaces instantly across your connected devices.
          Zero dependency installations, intelligent folder exclusions, and verified device identity.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto mb-16">
          <Link
            href="/codedrop"
            className="btn-primary px-8 py-3.5 rounded-2xl text-sm font-bold tracking-wide shadow-skeuo-btn"
          >
            <FolderCode className="w-4 h-4 drop-shadow" />
            <span>Open CodeDrop</span>
          </Link>

          <Link
            href="/devices"
            className="btn-secondary px-6 py-3.5 rounded-2xl text-sm font-semibold"
          >
            <Laptop className="w-4 h-4 text-cyan-400" />
            <span>My Devices</span>
          </Link>

          <Link
            href="/clipboard"
            className="btn-secondary px-6 py-3.5 rounded-2xl text-sm font-semibold"
          >
            <Clipboard className="w-4 h-4 text-indigo-400" />
            <span>Clipboard Hub</span>
          </Link>

          <Link
            href="/sync"
            className="btn-secondary px-6 py-3.5 rounded-2xl text-sm font-semibold"
          >
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Live Sync</span>
          </Link>
        </div>

        {/* 4 Feature Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {/* Card 1: CodeDrop */}
          <div className="glass-card p-6 rounded-3xl hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-center mb-4">
              <FolderCode className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              CodeDrop Workspaces
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Select entire project directories. Automatically skips <code className="font-mono text-cyan-400">node_modules</code> and build caches while safeguarding <code className="font-mono text-amber-400">.env</code>.
            </p>
            <Link
              href="/codedrop"
              className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:underline"
            >
              <span>Upload Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2: Device Routing */}
          <div className="glass-card p-6 rounded-3xl hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-center mb-4">
              <Laptop className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Send to Device
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Transfer items directly to target devices — whether your laptop, tablet, or phone — with live presence beacons and QR pairing.
            </p>
            <Link
              href="/devices"
              className="inline-flex items-center gap-1 text-xs font-bold text-teal-400 hover:underline"
            >
              <span>Manage Devices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Clipboard Sync */}
          <div className="glass-card p-6 rounded-3xl hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-center mb-4">
              <Clipboard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Clipboard Hub
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Cross-device clipboard bridge for snippets, URLs, and code. Respects browser permissions with honest permission states.
            </p>
            <Link
              href="/clipboard"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline"
            >
              <span>Open Clipboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 4: S3 Object Storage */}
          <div className="glass-card p-6 rounded-3xl hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Encrypted File Vault
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Direct-to-S3 presigned uploads, expiration windows, download limits, password encryption, and chunked download streaming.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:underline"
            >
              <span>Upload Files</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Developer Architecture & Philosophy */}
      <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-200 dark:border-neutral-800/80">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-3">
            Built for Developer Workflows
          </h2>
          <p className="text-sm text-neutral-500">
            VaultDrop is a personal transfer platform, not a cloud IDE. Pure static inspection, encrypted object storage, zero dependency runs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-3 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
              <Cpu className="w-4 h-4" />
              <span>Static Health Reports</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Detects framework, language, package managers, and configuration heuristics purely from directory inspection without running untrusted scripts.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-3 text-amber-500 font-bold text-sm">
              <Lock className="w-4 h-4" />
              <span>Sensitive-File Awareness</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Never silently discards or publicly exposes <code className="font-mono">.env</code> files. Flags credentials and gives you explicit consent toggles.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-3 text-indigo-500 font-bold text-sm">
              <Layers className="w-4 h-4" />
              <span>Point-in-Time Snapshots</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Preserve point-in-time states of your active projects before major refactors, allowing one-click download as structured ZIP archives.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
