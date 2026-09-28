import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import { getGitHubAppConfig } from '@/lib/github/app';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(request.url);

    if (!user) {
      const loginUrl = new URL('/login', url.origin);
      loginUrl.searchParams.set('callbackUrl', '/github');
      return NextResponse.redirect(loginUrl);
    }

    const { clientId, callbackUrl } = getGitHubAppConfig();
    const returnUrl = url.searchParams.get('returnUrl') || '/github';

    // Generate cryptographically secure random token
    const stateToken = crypto.randomBytes(32).toString('hex');
    const secret = process.env.NEXTAUTH_SECRET || 'vaultdrop-oauth-secret';
    
    // HMAC signature to guarantee state belongs to this specific user and origin
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${user.id}:${stateToken}:${url.origin}`)
      .digest('hex');

    const stateData = Buffer.from(
      JSON.stringify({
        token: stateToken,
        userId: user.id,
        returnUrl,
        origin: url.origin,
        sig,
      })
    ).toString('base64url');

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('state', stateData);
    githubAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    // Request consent so user can switch GitHub accounts if multiple exist
    githubAuthUrl.searchParams.set('prompt', 'consent');

    const response = NextResponse.redirect(githubAuthUrl);

    // Set secure HTTP-only cookie with state token
    response.cookies.set('vaultdrop_github_oauth_state', stateToken, {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('GitHub Connect initiation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to initiate GitHub connection' },
      { status: 500 }
    );
  }
}
