export const CONFIG = {
  // File limits
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
  MAX_TOTAL_SHARE_SIZE: parseInt(process.env.MAX_TOTAL_SHARE_SIZE || '209715200'), // 200MB
  MAX_FILES_PER_SHARE: parseInt(process.env.MAX_FILES_PER_SHARE || '20'),

  // Share token
  SHARE_CODE_LENGTH: 6,
  SHARE_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // No 0/O, 1/I

  // Expiration presets (in seconds)
  EXPIRATION_OPTIONS: [
    { label: '1 hour', value: 3600 },
    { label: '6 hours', value: 21600 },
    { label: '24 hours', value: 86400 },
    { label: '3 days', value: 259200 },
    { label: '7 days', value: 604800 },
    { label: '30 days', value: 2592000 },
    { label: 'Never', value: 0 },
  ],

  // Download limit presets
  DOWNLOAD_LIMIT_OPTIONS: [
    { label: 'Unlimited', value: 0 },
    { label: '1 download', value: 1 },
    { label: '5 downloads', value: 5 },
    { label: '10 downloads', value: 10 },
    { label: '25 downloads', value: 25 },
    { label: '100 downloads', value: 100 },
  ],

  // Rate limiting
  RATE_LIMIT: {
    UPLOAD: { windowMs: 60000, max: 10 },
    DOWNLOAD: { windowMs: 60000, max: 30 },
    LOOKUP: { windowMs: 60000, max: 60 },
    PASSWORD: { windowMs: 300000, max: 10 },
    AUTH: { windowMs: 900000, max: 15 },
  },

  // Allowed MIME types (empty = allow all)
  BLOCKED_MIME_TYPES: [
    'application/x-msdownload',
    'application/x-msdos-program',
  ],

  // App
  APP_NAME: 'VaultDrop',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://vaultdrop-eta.vercel.app',
} as const;

export function formatBytes(bytes: number | bigint): string {
  const b = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getExpirationDate(seconds: number): Date | null {
  if (seconds === 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

export function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

export function timeUntilExpiry(expiresAt: Date | null): string {
  if (!expiresAt) return 'Never';
  const now = Date.now();
  const expiry = expiresAt.getTime();
  const diff = expiry - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
