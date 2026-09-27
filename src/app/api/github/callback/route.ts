import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  getGitHubAppConfig,
  exchangeOAuthCode,
  getGitHubUserProfile,
  getInstallationForUser,
} from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const queryInstallationId = url.searchParams.get('installation_id');

  const cookieStore = cookies();
  const storedStateToken = cookieStore.get('vaultdrop_github_oauth_state')?.value;

  // Handle OAuth error (e.g. user cancelled)
  if (error) {
    console.warn(`GitHub OAuth error: ${error} - ${errorDescription}`);
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', errorDescription || error);
    return NextResponse.redirect(redirectUrl);
  }

  // Validate state parameter to prevent CSRF attacks
  if (!state || !storedStateToken) {
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', 'Invalid or expired OAuth state token.');
    return NextResponse.redirect(redirectUrl);
  }

  let stateData: { token: string; userId: string; returnUrl?: string };
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    stateData = JSON.parse(decoded);
  } catch {
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', 'Malformed OAuth state.');
    return NextResponse.redirect(redirectUrl);
  }

  if (stateData.token !== storedStateToken) {
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', 'OAuth state verification failed. Possible CSRF attempt.');
    return NextResponse.redirect(redirectUrl);
  }

  // Validate authenticated VaultDrop user session
  const user = await getSessionUser();
  if (!user || user.id !== stateData.userId) {
    const redirectUrl = new URL('/login', url.origin);
    redirectUrl.searchParams.set('callbackUrl', '/github');
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', 'Missing authorization code from GitHub.');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const { callbackUrl } = getGitHubAppConfig();

    // 1. Exchange authorization code for user access token
    const userAccessToken = await exchangeOAuthCode(code, callbackUrl);

    // 2. Fetch authenticated GitHub profile
    const profile = await getGitHubUserProfile(userAccessToken);

    // 3. Determine GitHub App installation ID
    let installationId: number | null = queryInstallationId ? parseInt(queryInstallationId, 10) : null;

    if (!installationId) {
      // Check if user/org has the app installed via App JWT
      const installation = await getInstallationForUser(profile.login).catch(() => null);
      if (installation && installation.id) {
        installationId = installation.id;
      }
    }

    if (!installationId) {
      // Try querying user installations via OAuth token
      try {
        const userInstRes = await fetch('https://api.github.com/user/installations', {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'VaultDrop-Sync-App',
          },
        });
        if (userInstRes.ok) {
          const userInstData = await userInstRes.json();
          const found = userInstData.installations?.find(
            (inst: any) =>
              inst.app_id === parseInt(process.env.GITHUB_APP_ID || '0', 10) ||
              inst.app_slug === 'vaultdrop-sync'
          );
          if (found) {
            installationId = found.id;
          } else if (userInstData.installations?.length > 0) {
            // First installation
            installationId = userInstData.installations[0].id;
          }
        }
      } catch (err) {
        console.warn('Could not query user installations list:', err);
      }
    }

    // 4. Upsert GitHub connection record for the authenticated VaultDrop user
    const connection = await prisma.gitHubConnection.upsert({
      where: {
        vaultdropUserId_githubUserId: {
          vaultdropUserId: user.id,
          githubUserId: profile.id,
        },
      },
      update: {
        githubLogin: profile.login,
        githubAvatarUrl: profile.avatar_url,
        githubInstallationId: installationId,
        githubAccountType: profile.type || 'User',
        status: 'active',
        updatedAt: new Date(),
      },
      create: {
        vaultdropUserId: user.id,
        githubUserId: profile.id,
        githubLogin: profile.login,
        githubAvatarUrl: profile.avatar_url,
        githubInstallationId: installationId,
        githubAccountType: profile.type || 'User',
        status: 'active',
      },
    });

    // 5. Audit log the connection
    await prisma.gitHubOperation.create({
      data: {
        vaultdropUserId: user.id,
        operation: 'CONNECT',
        status: 'success',
        metadata: JSON.stringify({
          githubLogin: profile.login,
          installationId,
          connectionId: connection.id,
        }),
      },
    });

    // Clean up state cookie and redirect
    const targetUrl = new URL(stateData.returnUrl || '/github', url.origin);
    if (!installationId) {
      targetUrl.searchParams.set('needs_installation', 'true');
    } else {
      targetUrl.searchParams.set('connected', 'true');
    }

    const response = NextResponse.redirect(targetUrl);
    response.cookies.delete('vaultdrop_github_oauth_state');
    return response;
  } catch (err: any) {
    console.error('GitHub OAuth callback processing error:', err);
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', err?.message || 'Failed to complete GitHub connection.');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('vaultdrop_github_oauth_state');
    return response;
  }
}
