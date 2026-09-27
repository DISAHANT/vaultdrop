import Link from 'next/link';
import {
  FolderCode,
  Laptop,
  Clipboard,
  Radio,
  Upload,
  Download,
  Shield,
  Lock,
  ArrowRight,
  Zap,
  Layers,
  Cpu,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { VaultDropLogo } from '@/components/vaultdrop-logo';

export default function HomePage() {
  return (
    <div className="relative overflow-hidden min-h-screen">
      {/* Background Ambient Refractive Sheen */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-12 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.08] dark:opacity-[0.06] blur-[140px] bg-gradient-to-br from-sky-400 via-indigo-500 to-transparent" />
        <div className="absolute top-48 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] dark:opacity-[0.05] blur-[140px] bg-gradient-to-br from-amber-400 via-orange-500 to-transparent" />
        <div className="absolute bottom-28 left-1/3 w-[500px] h-[500px] rounded-full opacity-[0.06] dark:opacity-[0.04] blur-[140px] bg-gradient-to-br from-teal-400 to-transparent" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-20 pb-20 md:pt-32 md:pb-28 px-4 sm:px-6 max-w-7xl mx-auto z-10 text-center">
        {/* Floating 3D Glass Emblem with Subtle Ambient Illumination */}
        <div className="mb-6 flex justify-center animate-fade-in">
          <div className="relative p-2.5 rounded-3xl bg-neutral-950/60 dark:bg-black/80 backdrop-blur-2xl border border-white/20 dark:border-white/15 shadow-[0_12px_40px_-5px_rgba(0,0,0,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.4),0_0_25px_-5px_rgba(56,189,248,0.25)] hover:scale-105 hover:shadow-[0_16px_50px_-5px_rgba(0,0,0,0.9),inset_0_1px_2px_0_rgba(255,255,255,0.5),0_0_35px_-3px_rgba(56,189,248,0.4)] transition-all duration-300 cursor-pointer">
            <VaultDropLogo size="xl" showText={false} withGlow={false} />
          </div>
        </div>

        {/* Feature Announcement Pill with Skeuomorphic Glass Bevel */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-white/[0.04] text-neutral-800 dark:text-sky-300 border border-neutral-200/80 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.2)] mb-8">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>Cross-Device Bridge · Workspaces, GitHub Sync & Live Clipboard</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-neutral-900 dark:text-white max-w-4xl mx-auto mb-6 leading-[1.08]">
          Your personal bridge <br />
          <span className="bg-gradient-to-r from-sky-400 via-indigo-200 to-amber-300 bg-clip-text text-transparent">
            between your devices.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Move code, folders, clipboard data, and files seamlessly across your phones, laptops, and GitHub repositories.
          Zero dependency installations, intelligent safety filtering, and verified device encryption.
        </p>

        {/* Tactile Action Buttons with Skeuomorphic Highlights */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-3xl mx-auto mb-20">
          <Link
            href="/codedrop"
            className="skeuo-btn inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm tracking-normal shadow-lg shadow-sky-500/20"
          >
            <FolderCode className="w-4 h-4" />
            <span>Open CodeDrop</span>
          </Link>

          <Link
            href="/github"
            className="skeuo-btn inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-white font-bold text-sm border border-white/10 shadow-lg"
          >
            <GitBranch className="w-4 h-4 text-sky-400" />
            <span>GitHub Sync 2.0</span>
          </Link>

          <Link
            href="/upload"
            className="skeuo-btn inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/90 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.09] text-neutral-800 dark:text-neutral-200 font-semibold text-sm border border-neutral-200 dark:border-white/10"
          >
            <Upload className="w-4 h-4 text-purple-400" />
            <span>Upload Files</span>
          </Link>

          <Link
            href="/devices"
            className="skeuo-btn inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/90 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.09] text-neutral-800 dark:text-neutral-200 font-semibold text-sm border border-neutral-200 dark:border-white/10"
          >
            <Laptop className="w-4 h-4 text-teal-400" />
            <span>My Devices</span>
          </Link>

          <Link
            href="/sync"
            className="skeuo-btn inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/90 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.09] text-neutral-800 dark:text-neutral-200 font-semibold text-sm border border-neutral-200 dark:border-white/10"
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Live Sync</span>
          </Link>
        </div>

        {/* 4 Feature Pillars Grid with Glassmorphic Obsidian Depth */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          {/* Card 1: CodeDrop Workspaces */}
          <div className="glass-card p-6 rounded-3xl group transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <FolderCode className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              CodeDrop Workspaces
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
              Upload full code repositories. Automatically skips <code className="font-mono px-1 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px]">node_modules</code> while protecting <code className="font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]">.env</code> secrets.
            </p>
            <Link
              href="/codedrop"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 group-hover:gap-2 transition-all"
            >
              <span>Upload Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2: GitHub 2.0 Integration */}
          <div className="glass-card p-6 rounded-3xl group transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              GitHub Sync 2.0
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
              Commit code from VaultDrop straight to GitHub. Automatic secret scanners, Git trees, branch creation, and live CI status tracking.
            </p>
            <Link
              href="/github"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all"
            >
              <span>Connect Repositories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Send to Device */}
          <div className="glass-card p-6 rounded-3xl group transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <Laptop className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              Targeted Device Routing
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
              Transfer items directly to paired devices — whether your laptop, tablet, or phone — with live presence beacons and QR pairing.
            </p>
            <Link
              href="/devices"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:gap-2 transition-all"
            >
              <span>Manage Devices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 4: Clipboard Hub */}
          <div className="glass-card p-6 rounded-3xl group transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <Clipboard className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
              Live Clipboard Hub
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
              Seamless cross-device clipboard bridge for code snippets, tokens, and URLs. Respects browser permissions with honest states.
            </p>
            <Link
              href="/clipboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 group-hover:gap-2 transition-all"
            >
              <span>Open Clipboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Developer Architecture & Philosophy */}
      <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-200/80 dark:border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-3 tracking-tight">
            Engineered for Developer Productivity
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            VaultDrop is a secure developer workspace bridge. Pure static inspection, encrypted S3 object storage, and zero-leak Git pipelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-3xl transition-all">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="text-neutral-900 dark:text-sky-300 font-bold text-sm">Static Health Reports</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Detects framework, language, package managers, and configuration heuristics purely from directory inspection without running untrusted scripts.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl transition-all">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-neutral-900 dark:text-amber-300 font-bold text-sm">Credential Defense</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Never silently commits or publicly exposes <code className="font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold text-[11px]">.env</code> files or keys. Automatic secret scanner safeguards every push.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl transition-all">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-neutral-900 dark:text-purple-300 font-bold text-sm">Full Tree Snapshots</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Preserve exact directory structures and deterministic SHA-256 manifests, allowing seamless folder downloads as structured ZIP archives.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
