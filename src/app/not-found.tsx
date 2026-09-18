import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
        <FileQuestion className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-4xl font-bold mb-3">404</h1>
      <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>This page doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary">
        <Home className="w-5 h-5" /> Go Home
      </Link>
    </div>
  );
}
