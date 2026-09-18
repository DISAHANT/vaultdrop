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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)' }}>
                <p>VaultDrop — Secure File Sharing Platform</p>
              </footer>
            </div>
            <ToastProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
