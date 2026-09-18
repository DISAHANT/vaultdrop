import { z } from 'zod';
import { CONFIG } from '@/lib/config';

export const createShareSchema = z.object({
  title: z.string().max(255).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  password: z.string().min(1).max(128).optional(),
  expiresInSeconds: z.number().int().min(0).optional().default(86400),
  maxDownloads: z.number().int().min(0).optional().default(0),
});

export const updateShareSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  password: z.string().min(1).max(128).optional().nullable(),
  removePassword: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxDownloads: z.number().int().min(0).optional(),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1).max(128),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function validateFileUpload(file: { size: number; type: string; name: string }): {
  valid: boolean;
  error?: string;
} {
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds maximum size of ${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`,
    };
  }

  if ((CONFIG.BLOCKED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed`,
    };
  }

  return { valid: true };
}

export function validateTotalUpload(files: { size: number }[]): {
  valid: boolean;
  error?: string;
} {
  if (files.length > CONFIG.MAX_FILES_PER_SHARE) {
    return {
      valid: false,
      error: `Maximum ${CONFIG.MAX_FILES_PER_SHARE} files per share`,
    };
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > CONFIG.MAX_TOTAL_SHARE_SIZE) {
    return {
      valid: false,
      error: `Total upload size exceeds ${Math.round(CONFIG.MAX_TOTAL_SHARE_SIZE / 1024 / 1024)}MB limit`,
    };
  }

  return { valid: true };
}

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;
