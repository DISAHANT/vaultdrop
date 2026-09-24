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
      <body className="relative overflow-x-hidden min-h-screen bg-black text-white selection:bg-neutral-800 selection:text-white">
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="py-6 text-center text-xs tracking-wider uppercase text-neutral-500 dark:text-neutral-500 border-t border-black/[0.05] dark:border-white/[0.06] bg-black/[0.01] dark:bg-black/40 backdrop-blur-md">
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
