import { CONFIG } from '@/lib/config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60000);

export type RateLimitType = keyof typeof CONFIG.RATE_LIMIT;

export function checkRateLimit(
  identifier: string,
  type: RateLimitType
): { allowed: boolean; remaining: number; resetAt: number } {
  const config = CONFIG.RATE_LIMIT[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(key, entry);
  }

  entry.count++;
  const allowed = entry.count <= config.max;
  const remaining = Math.max(0, config.max - entry.count);

  return { allowed, remaining, resetAt: entry.resetAt };
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}
