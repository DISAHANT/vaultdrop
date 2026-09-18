'use client';

import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>An unexpected error occurred. Please try again.</p>
      <button onClick={reset} className="btn-primary">Try Again</button>
    </div>
  );
}
