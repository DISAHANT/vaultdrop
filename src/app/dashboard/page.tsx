'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { BarChart3, Files, Download, HardDrive, Upload, Clock, Copy, ExternalLink, Trash2, XCircle, ChevronRight, Search, Filter, Loader2 } from 'lucide-react';
import { formatBytes, formatDate, timeUntilExpiry } from '@/lib/config';

interface Stats {
  totalShares: number;
  activeShares: number;
  expiredShares: number;
  totalDownloads: number;
  totalFiles: number;
  totalStoredSize: string;
}

interface ShareItem {
  id: string;
  shareCode: string;
  title: string | null;
  status: string;
  totalFiles: number;
  totalSize: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  hasPassword: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, sharesRes] = await Promise.all([
        fetch('/api/user/stats'),
        fetch(`/api/user/shares?search=${encodeURIComponent(search)}&status=${statusFilter}&sortBy=${sortBy}`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (sharesRes.ok) {
        const data = await sharesRes.json();
        setShares(data.shares || []);
      }
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/receive/${code}`);
    toast.success('Link copied!');
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Delete this share? This cannot be undone.')) return;
    try {
      await fetch(`/api/shares/${code}`, { method: 'DELETE' });
      toast.success('Share deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleRevoke = async (code: string) => {
    if (!confirm('Revoke this share? Files will become inaccessible.')) return;
    try {
      await fetch(`/api/shares/${code}?action=revoke`, { method: 'DELETE' });
      toast.success('Share revoked');
      fetchData();
    } catch {
      toast.error('Failed to revoke');
    }
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return <div className="max-w-5xl mx-auto px-4 py-20"><div className="skeleton w-full h-64" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Welcome, {session?.user?.name || 'User'}</p>
        </div>
        <Link href="/upload" className="btn-primary">
          <Upload className="w-4 h-4" /> New Share
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Files, label: 'Total Shares', value: stats.totalShares, sub: `${stats.activeShares} active` },
            { icon: BarChart3, label: 'Total Downloads', value: stats.totalDownloads, sub: 'all time' },
            { icon: HardDrive, label: 'Files Stored', value: stats.totalFiles, sub: formatBytes(BigInt(stats.totalStoredSize)) },
            { icon: Clock, label: 'Expired', value: stats.expiredShares, sub: 'shares' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shares..." className="input pl-10 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto text-sm">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="REVOKED">Revoked</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input w-auto text-sm">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="downloads">Most Downloads</option>
        </select>
      </div>

      {/* Shares List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton w-full h-20" />)}</div>
      ) : shares.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Files className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-lg font-semibold mb-2">No shares yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Create your first share to see it here</p>
          <Link href="/upload" className="btn-primary">
            <Upload className="w-4 h-4" /> Create Share
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map(share => (
            <div key={share.id} className="file-card group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>{share.shareCode}</span>
                  <span className={`badge ${share.status === 'ACTIVE' ? 'badge-active' : share.status === 'EXPIRED' ? 'badge-expired' : 'badge-revoked'}`}>
                    {share.status}
                  </span>
                  {share.hasPassword && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>🔒</span>}
                </div>
                <p className="text-sm font-medium truncate">{share.title || 'Untitled'}</p>
                <div className="flex items-center gap-3 text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{share.totalFiles} files</span>
                  <span>{formatBytes(BigInt(share.totalSize))}</span>
                  <span>{share.downloadCount} downloads</span>
                  <span>{share.expiresAt ? timeUntilExpiry(new Date(share.expiresAt)) : 'No expiry'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => copyCode(share.shareCode)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]" title="Copy code">
                  <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => copyLink(share.shareCode)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]" title="Copy link">
                  <ExternalLink className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                {share.status === 'ACTIVE' && (
                  <button onClick={() => handleRevoke(share.shareCode)} className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20" title="Revoke">
                    <XCircle className="w-4 h-4 text-amber-500" />
                  </button>
                )}
                <button onClick={() => handleDelete(share.shareCode)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
