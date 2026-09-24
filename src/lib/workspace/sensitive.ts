/**
 * Sensitive file detector for VaultDrop CodeDrop
 * Identifies environment variables, secrets, keys, and credentials
 * without deleting or blocking them — empowers the user to include or exclude.
 */

export interface SensitivePattern {
  id: string;
  name: string;
  pattern: RegExp;
  description: string;
  defaultInclude: boolean; // false = prompt user or exclude by default
}

export const SENSITIVE_PATTERNS: SensitivePattern[] = [
  {
    id: 'env-files',
    name: 'Environment Configuration',
    pattern: /^\.env(\.[a-zA-Z0-9_\-]+)?$/i,
    description: 'May contain database URLs, API secrets, or private environment variables.',
    defaultInclude: false,
  },
  {
    id: 'ssh-keys',
    name: 'SSH / Private Key',
    pattern: /(id_rsa|id_ed25519|id_ecdsa|\.pem|\.key|\.pkcs8|\.p12|\.pfx)$/i,
    description: 'Cryptographic private key or certificate.',
    defaultInclude: false,
  },
  {
    id: 'credentials',
    name: 'Credentials File',
    pattern: /(credentials\.json|service-account\.json|gcloud-credentials\.json|aws_credentials|client_secret.*\.json)$/i,
    description: 'Cloud provider or service account credentials.',
    defaultInclude: false,
  },
  {
    id: 'keystores',
    name: 'App Signing Keystore',
    pattern: /(\.jks|\.keystore|\.mobileprovision)$/i,
    description: 'Mobile application signing keys and certificates.',
    defaultInclude: false,
  },
  {
    id: 'auth-tokens',
    name: 'Auth Token / Secret Store',
    pattern: /(\.npmrc|\.pypirc|\.netrc)$/i,
    description: 'Package registry authorization tokens.',
    defaultInclude: false,
  },
];

export interface SensitiveDetectionResult {
  isSensitive: boolean;
  matchedRule?: SensitivePattern;
}

/**
 * Checks if a relative file path matches known sensitive patterns.
 */
export function checkSensitiveFile(relativePath: string): SensitiveDetectionResult {
  const normalized = relativePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';

  for (const rule of SENSITIVE_PATTERNS) {
    if (rule.pattern.test(filename)) {
      return {
        isSensitive: true,
        matchedRule: rule,
      };
    }
  }

  return { isSensitive: false };
}
