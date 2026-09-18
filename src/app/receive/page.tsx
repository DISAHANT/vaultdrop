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
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
          <Download className="w-8 h-8" style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Receive Files</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Enter the share code to access files</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6">
        <label className="block text-sm font-medium mb-2">Share Code</label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A7K92P"
              className="input pl-11 font-mono text-lg tracking-widest uppercase"
              maxLength={20}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" disabled={code.trim().length < 4} className="btn-primary px-6">
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
          Enter the 6-character code shared with you
        </p>
      </form>
    </div>
  );
}
