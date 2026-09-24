'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ArrowRight, Search } from 'lucide-react';

export default function ReceivePage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length >= 4) {
      router.push(`/receive/${clean}`);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-20 md:py-32">
      <div className="text-center mb-10 space-y-2">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 shadow-sm">
          <Download className="w-6 h-6" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Receive Files
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Enter the unique 6-character share token to access files</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Share Code</label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A7K92P"
              className="input pl-12 font-mono text-lg tracking-widest uppercase"
              maxLength={20}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" disabled={code.trim().length < 4} className="btn-primary px-5">
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 pt-1">
          Instant high-speed transfer directly to your browser with streaming progress.
        </p>
      </form>
    </div>
  );
}
