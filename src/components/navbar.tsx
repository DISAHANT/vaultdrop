'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ThemeToggle } from './theme-toggle';
import { NotificationBell } from './notification-bell';
import { VaultDropLogo } from './vaultdrop-logo';
import {
  FolderCode,
  Laptop,
  Clipboard,
  Radio,
  Upload,
  Download,
  LayoutDashboard,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  Layers,
  GitBranch,
  ArrowLeftRight,
} from 'lucide-react';

const mainNavLinks = [
  { href: '/codedrop', label: 'CodeDrop', icon: FolderCode, color: 'text-sky-400' },
  { href: '/workspaces', label: 'Workspaces', icon: Layers, color: 'text-indigo-400' },
  { href: '/transfers', label: 'Transfers', icon: ArrowLeftRight, color: 'text-amber-400' },
  { href: '/github', label: 'GitHub', icon: GitBranch, color: 'text-sky-400' },
  { href: '/devices', label: 'Devices', icon: Laptop, color: 'text-teal-400' },
  { href: '/clipboard', label: 'Clipboard', icon: Clipboard, color: 'text-violet-400' },
  { href: '/sync', label: 'Live Sync', icon: Radio, color: 'text-emerald-400' },
  { href: '/upload', label: 'Upload', icon: Upload, color: 'text-purple-400' },
  { href: '/receive', label: 'Receive', icon: Download, color: 'text-amber-400' },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-[#07090e]/85 backdrop-blur-2xl border-b border-neutral-200/80 dark:border-white/[0.08] transition-all duration-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_30px_-5px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo with 3D Glass Liquid V Droplet */}
          <VaultDropLogo href="/" size="md" withGlow={true} />

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-neutral-100/80 dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.07]">
            {mainNavLinks.map(({ href, label, icon: Icon, color }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 select-none ${
                    active
                      ? 'text-neutral-900 dark:text-white bg-white dark:bg-white/[0.12] shadow-sm border border-neutral-200/90 dark:border-white/10'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? color : 'text-neutral-500 dark:text-neutral-400'}`} />
                  <span>{label}</span>
                </Link>
              );
            })}

            {session && (
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 select-none ${
                  pathname.startsWith('/dashboard')
                    ? 'text-neutral-900 dark:text-white bg-white dark:bg-white/[0.12] shadow-sm border border-neutral-200/90 dark:border-white/10'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${pathname.startsWith('/dashboard') ? 'text-amber-500 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400'}`} />
                <span>Dashboard</span>
              </Link>
            )}
          </nav>

          {/* Right Action Icons & Auth */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <NotificationBell />

            {session ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-100/90 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/10 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-sky-500/40 dark:hover:border-sky-500/30 transition-all"
                >
                  <User className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                  <span className="max-w-[120px] truncate">{session.user?.name || session.user?.email}</span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs py-2 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold transition-all shadow-sm shadow-sky-500/25 hover:shadow-md hover:-translate-y-0.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/[0.1] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav className="lg:hidden py-4 border-t border-neutral-200/80 dark:border-white/[0.08] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {mainNavLinks.map(({ href, label, icon: Icon, color }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'text-neutral-950 dark:text-white bg-white dark:bg-white/[0.12] border border-neutral-200 dark:border-white/10 shadow-sm font-bold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? color : 'text-neutral-400'}`} />
                    <span>{label}</span>
                  </Link>
                );
              })}
              {session && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold transition-all ${
                    pathname.startsWith('/dashboard')
                      ? 'text-neutral-950 dark:text-white bg-white dark:bg-white/[0.12] border border-neutral-200 dark:border-white/10 shadow-sm font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.05] border border-transparent'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-400" />
                  <span>Dashboard</span>
                </Link>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-white/[0.08] flex items-center justify-between">
              {session ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">
                      {session.user?.name || session.user?.email}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 text-xs text-rose-400 font-semibold px-3 py-1.5 rounded-xl hover:bg-rose-500/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-xs shadow-md"
                >
                  <span>Sign In to VaultDrop</span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
