'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ThemeToggle } from './theme-toggle';
import {
  Shield,
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
} from 'lucide-react';

const mainNavLinks = [
  { href: '/codedrop', label: 'CodeDrop', icon: FolderCode },
  { href: '/workspaces', label: 'Workspaces', icon: Layers },
  { href: '/devices', label: 'Devices', icon: Laptop },
  { href: '/clipboard', label: 'Clipboard', icon: Clipboard },
  { href: '/sync', label: 'Live Sync', icon: Radio },
  { href: '/upload', label: 'Upload File', icon: Upload },
  { href: '/receive', label: 'Receive', icon: Download },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full bg-white/85 dark:bg-black/85 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.10] shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.85)] transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 shadow-[0_4px_16px_rgba(0,240,255,0.35),inset_0_1px_1px_rgba(255,255,255,0.6)] border border-white/20 group-hover:scale-105 transition-transform duration-200">
              <Shield className="w-5 h-5 text-white drop-shadow" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
              VAULT<span className="text-cyan-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.5)]">DROP</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] backdrop-blur-xl">
            {mainNavLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 select-none ${
                    active
                      ? 'text-cyan-600 dark:text-cyan-300 bg-white dark:bg-white/[0.10] shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] border border-cyan-500/30'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-500 dark:text-cyan-300' : ''}`} />
                  <span>{label}</span>
                </Link>
              );
            })}

            {session && (
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 select-none ${
                  pathname.startsWith('/dashboard')
                    ? 'text-cyan-600 dark:text-cyan-300 bg-white dark:bg-white/[0.10] shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] border border-cyan-500/30'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            )}
          </nav>

          {/* Right Action Icons & Auth */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {session ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200/80 dark:border-white/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-cyan-500/50 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="max-w-[120px] truncate">{session.user?.name || session.user?.email}</span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-b from-neutral-800 to-neutral-950 text-white dark:from-white dark:to-neutral-200 dark:text-black border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-110 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav className="lg:hidden py-4 border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {mainNavLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold ${
                      active
                        ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 font-bold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
              {session && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold ${
                    pathname.startsWith('/dashboard')
                      ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              {session ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-500" />
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">
                      {session.user?.name || session.user?.email}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 text-xs text-rose-500 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-500/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 text-white font-bold text-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In with Google / Account</span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
