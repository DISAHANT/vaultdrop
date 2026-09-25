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
  { href: '/codedrop', label: 'CodeDrop', icon: FolderCode, color: 'text-cyan-500' },
  { href: '/workspaces', label: 'Workspaces', icon: Layers, color: 'text-indigo-500' },
  { href: '/devices', label: 'Devices', icon: Laptop, color: 'text-teal-500' },
  { href: '/clipboard', label: 'Clipboard', icon: Clipboard, color: 'text-violet-500' },
  { href: '/sync', label: 'Live Sync', icon: Radio, color: 'text-emerald-500' },
  { href: '/upload', label: 'Upload File', icon: Upload, color: 'text-violet-500' },
  { href: '/receive', label: 'Receive', icon: Download, color: 'text-amber-500' },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full bg-white/85 dark:bg-black/90 backdrop-blur-2xl border-b border-slate-200/90 dark:border-white/[0.08] transition-colors shadow-sm dark:shadow-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500 to-violet-600 text-white border border-cyan-400/30 shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Shield className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              VAULT<span className="bg-gradient-to-r from-cyan-500 to-violet-600 bg-clip-text text-transparent font-extrabold ml-0.5">DROP</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/[0.06]">
            {mainNavLinks.map(({ href, label, icon: Icon, color }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
                    active
                      ? 'text-indigo-600 dark:text-white bg-white dark:bg-white/[0.12] shadow-sm border border-slate-200/90 dark:border-white/10'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? color : 'text-slate-400 dark:text-neutral-400'}`} />
                  <span>{label}</span>
                </Link>
              );
            })}

            {session && (
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
                  pathname.startsWith('/dashboard')
                    ? 'text-indigo-600 dark:text-white bg-white dark:bg-white/[0.12] shadow-sm border border-slate-200/90 dark:border-white/10'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.06]'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${pathname.startsWith('/dashboard') ? 'text-amber-500' : ''}`} />
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-cyan-500/30 dark:hover:border-cyan-500/20 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-cyan-500" />
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
                className="btn-accent-cyan hidden sm:inline-flex text-xs py-2 px-4 rounded-xl"
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
              {mainNavLinks.map(({ href, label, icon: Icon, color }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold ${
                      active
                        ? 'text-neutral-950 dark:text-white bg-neutral-100 dark:bg-white/[0.10] font-bold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? color : ''}`} />
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
                      ? 'text-neutral-950 dark:text-white bg-neutral-100 dark:bg-white/[0.10] font-bold'
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
                  className="btn-accent-cyan w-full text-xs py-2.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
