import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  getGitHubAppConfig,
  exchangeOAuthCode,
  getGitHubUserProfile,
  getInstallationForUser,
  getInstallationDetails,
} from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const queryInstallationId = url.searchParams.get('installation_id');

  // Handle OAuth error (e.g. user cancelled on GitHub)
  if (error) {
    console.warn(`GitHub OAuth error: ${error} - ${errorDescription}`);
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', errorDescription || error);
    return NextResponse.redirect(redirectUrl);
  }

  // Parse state parameter if present
  let stateData: {
    token: string;
    userId: string;
    returnUrl?: string;
    origin?: string;
    sig?: string;
  } | null = null;

  if (state) {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      stateData = JSON.parse(decoded);
    } catch {
      console.warn('Failed to parse OAuth state token');
    }
  }

  // Cross-origin relay: if OAuth was initiated from localhost but redirected to production, relay back
  if (stateData?.origin) {
    try {
      const originUrl = new URL(stateData.origin);
      const requestHost = request.headers.get('host') || url.host;
      if (
        originUrl.host !== requestHost &&
        (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
      ) {
        const relayUrl = new URL('/api/github/callback', stateData.origin);
        url.searchParams.forEach((val, key) => relayUrl.searchParams.set(key, val));
        return NextResponse.redirect(relayUrl);
      }
    } catch (err) {
      console.warn('Relay check error:', err);
    }
  }

  // Verify HMAC signature of state data to prevent CSRF attacks
  if (stateData) {
    const secret = process.env.NEXTAUTH_SECRET || 'vaultdrop-oauth-secret';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${stateData.userId}:${stateData.token}:${stateData.origin || ''}`)
      .digest('hex');

    if (stateData.sig && stateData.sig !== expectedSig) {
      console.error('OAuth state signature verification failed');
      const redirectUrl = new URL('/github', url.origin);
      redirectUrl.searchParams.set('error', 'OAuth state verification failed. Possible CSRF attempt.');
      return NextResponse.redirect(redirectUrl);
    }

    const cookieStore = cookies();
    const storedStateToken = cookieStore.get('vaultdrop_github_oauth_state')?.value;
    if (storedStateToken && stateData.token !== storedStateToken) {
      console.error('OAuth state token cookie mismatch');
      const redirectUrl = new URL('/github', url.origin);
      redirectUrl.searchParams.set('error', 'OAuth state cookie mismatch. Please try again.');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Validate authenticated VaultDrop user session
  const user = await getSessionUser();
  if (!user) {
    const redirectUrl = new URL('/login', url.origin);
    redirectUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // STRICT USER ISOLATION:
  // If stateData has a userId, ensure the currently authenticated user matches it exactly!
  if (stateData && user.id !== stateData.userId) {
    console.error(`User mismatch: session user ${user.id} !== state user ${stateData.userId}`);
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set(
      'error',
      'Session mismatch. The GitHub connection attempt was initiated by a different VaultDrop user.'
    );
    return NextResponse.redirect(redirectUrl);
  }

  // Special case: App installation callback without OAuth code (user installed app directly)
  if (!code && queryInstallationId) {
    try {
      const instId = parseInt(queryInstallationId, 10);
      const instDetails = await getInstallationDetails(instId);

      if (instDetails && instDetails.id) {
        const activeConn = await prisma.gitHubConnection.findFirst({
          where: { vaultdropUserId: user.id, status: 'active' },
        });

        if (activeConn) {
          await prisma.gitHubConnection.update({
            where: { id: activeConn.id },
            data: {
              githubInstallationId: instDetails.id,
              updatedAt: new Date(),
            },
          });

          await prisma.gitHubOperation.create({
            data: {
              vaultdropUserId: user.id,
              operation: 'INSTALL',
              status: 'success',
              metadata: JSON.stringify({
                installationId: instDetails.id,
                account: instDetails.account?.login,
              }),
            },
          });

          const redirectUrl = new URL(stateData?.returnUrl || '/github', url.origin);
          redirectUrl.searchParams.set('connected', 'true');
          const response = NextResponse.redirect(redirectUrl);
          response.cookies.delete('vaultdrop_github_oauth_state');
          return response;
        }
      }
    } catch (instErr: any) {
      console.warn('Handling direct installation callback error:', instErr?.message);
    }
  }

  if (!code) {
    const redirectUrl = new URL('/github', url.origin);
    redirectUrl.searchParams.set('error', 'Missing authorization code from GitHub.');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const { callbackUrl, appId } = getGitHubAppConfig();

    // 1. Exchange authorization code for user access token
    const userAccessToken = await exchangeOAuthCode(code, callbackUrl);

    // 2. Fetch authenticated GitHub profile
    const profile = await getGitHubUserProfile(userAccessToken);

    // 3. Determine GitHub App installation ID strictly for this GitHub account
    let installationId: number | null = null;

    // Check query installation ID first if valid and matching
    if (queryInstallationId) {
      try {
        const queryId = parseInt(queryInstallationId, 10);
        const instDetails = await getInstallationDetails(queryId);
        if (
          instDetails &&
          (instDetails.account?.login?.toLowerCase() === profile.login.toLowerCase() ||
            instDetails.account?.id === profile.id)
        ) {
          installationId = instDetails.id;
        }
      } catch (err) {
        console.warn('Failed to verify query installation ID:', err);
      }
    }

    // Check user/org installation via App JWT
    if (!installationId) {
      const installation = await getInstallationForUser(profile.login).catch(() => null);
      if (installation && installation.id) {
        installationId = installation.id;
      }
    }

    // Check user installations list via OAuth token
    if (!installationId) {
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
              (inst.app_id === parseInt(appId, 10) || inst.app_slug === 'vaultdrop-sync') &&
              (inst.account?.login?.toLowerCase() === profile.login.toLowerCase() ||
                inst.account?.id === profile.id)
          );
          if (found) {
            installationId = found.id;
          }
        }
      } catch (err) {
        console.warn('Could not query user installations list:', err);
      }
    }

    // 4. Strict account isolation: Revoke any previous active connections for this VaultDrop user
    // under a different GitHub account to maintain strict 1-to-1 connection integrity
    await prisma.gitHubConnection.updateMany({
      where: {
        vaultdropUserId: user.id,
        githubUserId: { not: profile.id },
        status: 'active',
      },
      data: {
        status: 'revoked',
      },
    });

    // 5. Upsert GitHub connection record for the authenticated VaultDrop user
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
        accessToken: userAccessToken,
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
        accessToken: userAccessToken,
        status: 'active',
      },
    });

    // 6. Audit log the connection
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
    const targetUrl = new URL(stateData?.returnUrl || '/github', url.origin);
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
