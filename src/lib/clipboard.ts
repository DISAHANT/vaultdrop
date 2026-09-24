/**
 * Realistic Browser Clipboard Manager & Type Detector for VaultDrop
 * 
 * NOTE: Standard browser security prevents background silent monitoring of the OS clipboard.
 * User interaction or explicit permission is required for reading/writing.
 */

export type ClipboardPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type ClipboardContentType = 'text' | 'url' | 'code' | 'image';

export interface ClipboardItemData {
  id?: string;
  content: string;
  type: ClipboardContentType;
  metadata?: Record<string, any>;
  deviceId?: string;
  createdAt?: string;
}

/**
 * Checks the browser's clipboard permission status safely.
 */
export async function queryClipboardPermission(): Promise<ClipboardPermissionState> {
  if (typeof window === 'undefined' || !navigator.clipboard) {
    return 'unsupported';
  }

  try {
    if (navigator.permissions && navigator.permissions.query) {
      // TypeScript type cast for clipboard-read permission
      const result = await navigator.permissions.query({ name: 'clipboard-read' as any });
      return result.state as ClipboardPermissionState;
    }
  } catch {
    // Some browsers (like Firefox or older Safari) throw or don't support querying clipboard
  }

  return 'prompt';
}

/**
 * Deterministically categorizes clipboard text content into url, code, or plain text.
 */
export function detectContentType(content: string): ClipboardContentType {
  if (!content) return 'text';
  const trimmed = content.trim();

  // URL detection
  if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) {
    return 'url';
  }

  // Code heuristic detection
  const codePatterns = [
    /^(import|export|const|let|var|function|class|def|public|private|fn|struct|impl)\s+/m,
    /[{}[\]();]{3,}/,
    /<\/?[a-z][\s\S]*>/i,
    /SELECT\s+.+\s+FROM\s+/i,
    /^\s*(\/\/|#|\/\*)/m,
  ];

  const codeScore = codePatterns.filter((p) => p.test(trimmed)).length;
  if (codeScore >= 1 && (trimmed.includes('\n') || trimmed.length > 40)) {
    return 'code';
  }

  return 'text';
}

/**
 * Reads text from system clipboard using standard Web API.
 */
export async function readSystemClipboard(): Promise<{ content: string; type: ClipboardContentType } | null> {
  if (typeof window === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
    throw new Error('Clipboard API is not supported by your browser.');
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) return null;
    return {
      content: text,
      type: detectContentType(text),
    };
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      throw new Error('Clipboard read permission was denied by your browser. Please allow clipboard access in browser settings.');
    }
    throw new Error(err.message || 'Failed to read clipboard.');
  }
}

/**
 * Writes text to system clipboard.
 */
export async function writeSystemClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Direct clipboard write failed, attempting document.execCommand fallback:', err);
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
}
