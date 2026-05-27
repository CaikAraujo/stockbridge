import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/login/verify', '/login/error', '/login/totp'];

// Rotas públicas que admins logados ainda podem acessar (step-up TOTP)
const TOTP_PATH = '/login/totp';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const sessionToken =
    request.cookies.get('authjs.session-token') ??
    request.cookies.get('__Secure-authjs.session-token');
  const isLoggedIn = !!sessionToken;

  // Usuário logado tentando acessar rota pública:
  // exceção para /login/totp — admin precisa passar pelo step-up mesmo logado.
  if (isPublic && isLoggedIn && !pathname.startsWith(TOTP_PATH)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|icons).*)'],
};
