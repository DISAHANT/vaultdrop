import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/auth-provider';
import { ToastProvider } from '@/components/toast-provider';
import { Navbar } from '@/components/navbar';
import { VaultDropLogo } from '@/components/vaultdrop-logo';
import { IncomingTransferListener } from '@/components/incoming-transfer-listener';
import { PwaRegister } from '@/components/pwa-register';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#07090e',
};

export const metadata: Metadata = {
  title: 'VaultDrop — Cross-Device Workspace & Secure File Bridge',
  description: 'Ultra-fast, zero-leak file and workspace sync across all your devices and GitHub repositories with cryptographic integrity.',
  keywords: ['file sharing', 'secure', 'workspace sync', 'github integration', 'cross-device', 'encrypted storage'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VaultDrop',
  },
  openGraph: {
    title: 'VaultDrop — Cross-Device Workspace & Secure File Bridge',
    description: 'Instant, secure workspace and file synchronization across personal devices and GitHub.',
    type: 'website',
    images: ['/logo.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative overflow-x-hidden min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-sky-500/20 selection:text-slate-900 dark:selection:bg-sky-500/30 dark:selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="py-8 px-4 sm:px-6 border-t border-neutral-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-[#07090e]/85 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-3">
                    <VaultDropLogo size="sm" showText={true} withGlow={false} />
                    <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">|</span>
                    <span className="hidden sm:inline">Cross-Device Workspace & File Bridge</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Encrypted Cloud Active
                    </span>
                    <span>v2.0.0</span>
                  </div>
                </div>
              </footer>
            </div>
            <IncomingTransferListener />
            <PwaRegister />
            <ToastProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
