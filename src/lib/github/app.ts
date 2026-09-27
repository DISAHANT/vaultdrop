import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { parseGitHubError, GitHubApiError } from './errors';

interface TokenCacheEntry {
  token: string;
  expiresAt: number; // timestamp in ms
}

// In-memory cache for short-lived installation access tokens (valid ~1 hr)
const tokenCache = new Map<number, TokenCacheEntry>();

/**
 * Safely resolves the GitHub App RSA Private Key from environment or local PEM file
 */
export function getGitHubPrivateKey(): string {
  let privateKey = process.env.GITHUB_PRIVATE_KEY || '';

  // If set in environment, handle escaped newlines (\n)
  if (privateKey) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return privateKey.trim();
  }

  // Fallback: Check root for .pem file
  try {
    const rootPem = path.join(process.cwd(), 'vaultdrop-sync.2026-09-27.private-key.pem');
    if (fs.existsSync(rootPem)) {
      return fs.readFileSync(rootPem, 'utf-8').trim();
    }
  } catch (err) {
    console.warn('Failed to read private key from fallback pem file');
  }

  throw new Error('GITHUB_PRIVATE_KEY is not configured.');
}

/**
 * Returns GitHub App credentials
 */
export function getGitHubAppConfig() {
  const appId = process.env.GITHUB_APP_ID || '';
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';
  const appName = process.env.GITHUB_APP_NAME || 'VAULTDROP SYNC';
  const callbackUrl =
    process.env.GITHUB_CALLBACK_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://vaultdrop-eta.vercel.app'}/api/github/callback`;

  if (!appId || !clientId || !clientSecret) {
    throw new Error('GitHub App credentials are incompletely configured in environment.');
  }

  return {
    appId,
    clientId,
    clientSecret,
    webhookSecret,
    appName,
    callbackUrl,
  };
}

/**
 * Generates an RS256 signed JWT for authenticating as the GitHub App
 * Valid for 10 minutes (GitHub maximum) with a 60-second backward clock drift allowance
 */
export function generateAppJwt(): string {
  const { appId } = getGitHubAppConfig();
  const privateKey = getGitHubPrivateKey();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // 60 seconds clock drift leeway
    exp: now + 10 * 60, // 10 minutes validity
    iss: appId,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * Retrieves an installation access token for a given installation ID.
 * Caches tokens in memory for 50 minutes to avoid redundant regeneration requests.
 */
export async function getInstallationAccessToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  const now = Date.now();

  // Return cached token if valid for at least 5 more minutes
  if (cached && cached.expiresAt > now + 300_000) {
    return cached.token;
  }

  const appJwt = generateAppJwt();
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VaultDrop-Sync-App',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      parseGitHubError(
        { status: response.status, ...errorData },
        'Obtaining GitHub Installation Access Token'
      )
    );
  }

  const data = await response.json();
  const token = data.token;
  const expiresAt = new Date(data.expires_at).getTime();

  tokenCache.set(installationId, {
    token,
    expiresAt,
  });

  return token;
}

/**
 * Finds the installation associated with a specific GitHub user/organization
 */
export async function getInstallationForUser(githubLogin: string): Promise<any | null> {
  const appJwt = generateAppJwt();
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(githubLogin)}/installation`, {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VaultDrop-Sync-App',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      parseGitHubError({ status: response.status, ...err }, 'Finding GitHub User Installation')
    );
  }

  return response.json();
}

/**
 * Lists all repositories accessible by the given installation ID
 */
export async function listInstallationRepositories(
  installationId: number,
  page: number = 1,
  perPage: number = 100
): Promise<{ totalCount: number; repositories: any[] }> {
  const token = await getInstallationAccessToken(installationId);

  const response = await fetch(
    `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'VaultDrop-Sync-App',
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      parseGitHubError({ status: response.status, ...err }, 'Listing Accessible Repositories')
    );
  }

  const data = await response.json();
  return {
    totalCount: data.total_count,
    repositories: data.repositories || [],
  };
}

/**
 * Retrieves repository metadata including default branch, permissions, and status
 */
export async function getRepositoryMetadata(
  installationId: number,
  owner: string,
  repo: string
): Promise<any> {
  const token = await getInstallationAccessToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'VaultDrop-Sync-App',
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      parseGitHubError({ status: response.status, ...err }, `Fetching Repository ${owner}/${repo}`)
    );
  }

  return response.json();
}

/**
 * Exchanges OAuth authorization code for GitHub User Access Token
 */
export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<string> {
  const { clientId, clientSecret } = getGitHubAppConfig();

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'VaultDrop-Sync-App',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data.access_token;
}

/**
 * Fetches the authenticated GitHub user profile using their OAuth access token
 */
export async function getGitHubUserProfile(userToken: string): Promise<{
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  type: string;
}> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VaultDrop-Sync-App',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      parseGitHubError({ status: response.status, ...err }, 'Fetching GitHub User Profile')
    );
  }

  return response.json();
}
