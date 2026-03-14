import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy del callback OAuth de GHL hacia el backend en Railway.
 * GHL redirige aquí (Vercel) con ?code=XYZ, y nosotros lo
 * reenviamos al backend NestJS que procesa el token.
 */
export async function GET(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || 'https://gloory-api-endpoints-production.up.railway.app';
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?ghl_oauth_error=true', request.url));
  }

  const backendCallback = `${backendUrl}/api/hl/callback?code=${encodeURIComponent(code)}`;
  return NextResponse.redirect(backendCallback);
}
