'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

export function ToastProvider() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme as 'light' | 'dark' | 'system'}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)',
        },
      }}
    />
  );
}
