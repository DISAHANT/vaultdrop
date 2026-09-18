import crypto from 'crypto';
import { CONFIG } from '@/lib/config';
import prisma from '@/lib/db';

/**
 * Generates cryptographically secure, short, human-friendly share codes.
 * Excludes confusing characters (0/O, 1/I/l).
 * Case-insensitive lookup supported.
 */
export function generateShareCode(length: number = CONFIG.SHARE_CODE_LENGTH): string {
  const chars = CONFIG.SHARE_CODE_CHARS;
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Generates a unique share code with collision detection.
 * Retries up to maxRetries times if code already exists in DB.
 */
export async function generateUniqueShareCode(
  length: number = CONFIG.SHARE_CODE_LENGTH,
  maxRetries: number = 10
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateShareCode(length);
    const existing = await prisma.share.findUnique({
      where: { shareCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // If all retries failed, try with longer code
  return generateUniqueShareCode(length + 1, maxRetries);
}
