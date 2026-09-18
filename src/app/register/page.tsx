'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserPlus, Loader2, Shield } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Registration failed');
        return;
      }

      // Auto sign in
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.ok) {
        toast.success('Account created!');
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), #17895a)' }}>
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Create Account</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Get a dashboard, history, and analytics</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Your name" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="Min 8 characters" required minLength={8} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
        Already have an account? <Link href="/login" className="font-medium underline" style={{ color: 'var(--accent)' }}>Sign in</Link>
      </p>
    </div>
  );
}
