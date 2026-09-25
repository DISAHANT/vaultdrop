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
      {/* Background Ambient Color Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-12 left-1/3 w-[500px] h-[500px] rounded-full opacity-[0.07] dark:opacity-[0.12] blur-[100px] bg-cyan-500" />
        <div className="absolute top-48 right-1/4 w-[450px] h-[450px] rounded-full opacity-[0.05] dark:opacity-[0.10] blur-[100px] bg-violet-500" />
        <div className="absolute bottom-32 left-1/4 w-[400px] h-[400px] rounded-full opacity-[0.04] dark:opacity-[0.08] blur-[100px] bg-emerald-500" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 md:pt-36 md:pb-28 px-4 sm:px-6 max-w-7xl mx-auto z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-cyan-50 dark:bg-cyan-500/[0.06] text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/15 mb-8 shadow-sm">
          <Shield className="w-3.5 h-3.5" />
          <span>Cross-Device Bridge · Files, Clipboard & CodeDrop</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-neutral-900 dark:text-white max-w-4xl mx-auto mb-6">
          Your personal bridge <br />
          <span className="gradient-text-brand">
            between your devices.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Move files, clipboard content and project workspaces instantly across your connected devices.
          Zero dependency installations, intelligent folder exclusions, and verified device identity.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto mb-16">
          <Link
            href="/codedrop"
            className="btn-accent-cyan px-7 py-3 rounded-xl text-sm font-semibold tracking-normal"
          >
            <FolderCode className="w-4 h-4" />
            <span>Open CodeDrop</span>
          </Link>

          <Link
            href="/upload"
            className="btn-accent-violet px-5 py-3 rounded-xl text-sm font-semibold"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Files</span>
          </Link>

          <Link
            href="/devices"
            className="btn-secondary px-5 py-3 rounded-xl text-sm font-medium"
          >
            <Laptop className="w-4 h-4 text-teal-500" />
            <span>My Devices</span>
          </Link>

          <Link
            href="/sync"
            className="btn-accent-emerald px-5 py-3 rounded-xl text-sm font-semibold"
          >
            <Radio className="w-4 h-4" />
            <span>Live Sync</span>
          </Link>
        </div>

        {/* 4 Feature Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          {/* Card 1: CodeDrop */}
          <div className="glass-card p-6 rounded-2xl group hover:border-cyan-500/20 dark:hover:border-cyan-500/20 transition-all duration-200">
            <div className="icon-badge-cyan mb-4">
              <FolderCode className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              CodeDrop Workspaces
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Select entire project directories. Automatically skips <code className="font-mono text-cyan-600 dark:text-cyan-400">node_modules</code> and build caches while safeguarding <code className="font-mono text-amber-600 dark:text-amber-400">.env</code>.
            </p>
            <Link
              href="/codedrop"
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-500 transition-colors"
            >
              <span>Upload Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2: Device Routing */}
          <div className="glass-card p-6 rounded-2xl group hover:border-teal-500/20 dark:hover:border-teal-500/20 transition-all duration-200">
            <div className="icon-badge-teal mb-4">
              <Laptop className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              Send to Device
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Transfer items directly to target devices — whether your laptop, tablet, or phone — with live presence beacons and QR pairing.
            </p>
            <Link
              href="/devices"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-500 transition-colors"
            >
              <span>Manage Devices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Clipboard Sync */}
          <div className="glass-card p-6 rounded-2xl group hover:border-indigo-500/20 dark:hover:border-indigo-500/20 transition-all duration-200">
            <div className="icon-badge-indigo mb-4">
              <Clipboard className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              Clipboard Hub
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Cross-device clipboard bridge for snippets, URLs, and code. Respects browser permissions with honest permission states.
            </p>
            <Link
              href="/clipboard"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
            >
              <span>Open Clipboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 4: S3 Object Storage */}
          <div className="glass-card p-6 rounded-2xl group hover:border-violet-500/20 dark:hover:border-violet-500/20 transition-all duration-200">
            <div className="icon-badge-violet mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              Encrypted File Vault
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
              Direct-to-S3 presigned uploads, expiration windows, download limits, password encryption, and chunked download streaming.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:text-violet-500 transition-colors"
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
          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/20 dark:hover:border-cyan-500/15 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-badge-cyan !w-8 !h-8">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="text-cyan-700 dark:text-cyan-400 font-bold text-sm">Static Health Reports</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Detects framework, language, package managers, and configuration heuristics purely from directory inspection without running untrusted scripts.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/20 dark:hover:border-amber-500/15 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-badge-amber !w-8 !h-8">
                <Lock className="w-4 h-4" />
              </div>
              <span className="text-amber-700 dark:text-amber-400 font-bold text-sm">Sensitive-File Awareness</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Never silently discards or publicly exposes <code className="font-mono">.env</code> files. Flags credentials and gives you explicit consent toggles.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-violet-500/20 dark:hover:border-violet-500/15 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-badge-violet !w-8 !h-8">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-violet-700 dark:text-violet-400 font-bold text-sm">Point-in-Time Snapshots</span>
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
