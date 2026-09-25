import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/auth-provider';
import { ToastProvider } from '@/components/toast-provider';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'VaultDrop — Secure File Sharing',
  description: 'Share files quickly and securely. Upload files, get a short code, share the code, download anywhere.',
  keywords: ['file sharing', 'secure', 'upload', 'download', 'share code'],
  openGraph: {
    title: 'VaultDrop — Secure File Sharing',
    description: 'Share files quickly and securely with short share codes.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

import { IncomingTransferListener } from '@/components/incoming-transfer-listener';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative overflow-x-hidden min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-indigo-500/20 selection:text-slate-900 dark:selection:bg-neutral-800 dark:selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="py-6 text-center text-xs tracking-wider uppercase text-slate-500 dark:text-neutral-500 border-t border-slate-200/90 dark:border-white/[0.06] bg-white/70 dark:bg-black/40 backdrop-blur-md">
                <p>VaultDrop — Cross-Device Workspace & File Bridge</p>
              </footer>
            </div>
            <IncomingTransferListener />
            <ToastProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
