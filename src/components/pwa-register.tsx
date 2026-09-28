'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user dismissed previously in this session
      const dismissed = sessionStorage.getItem('vaultdrop_pwa_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // App installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed');
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted installation');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('vaultdrop_pwa_dismissed', 'true');
    }
  };

  if (!showInstallBanner || isDismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="glass-panel p-4 rounded-2xl border border-sky-500/30 bg-[#07090e]/95 backdrop-blur-xl shadow-2xl shadow-sky-950/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/30 border border-sky-400/30 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">Install VaultDrop App</p>
            <p className="text-[11px] text-neutral-400 truncate">Add to home screen for native experience</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="skeuo-btn px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500 text-white hover:bg-sky-400 transition-all shadow-md shadow-sky-500/20 cursor-pointer"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
