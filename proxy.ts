import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';

const PUBLIC_PATHS = ['/login', '/login/verify', '/login/error', '/login/totp'];
const DRIVER_HOME = '/driver';
const ADMIN_HOME = '/dashboard';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Redireciona usuário logado que tenta acessar login
  if (isPublic && isLoggedIn) {
    const dest = role === 'driver' ? DRIVER_HOME : ADMIN_HOME;
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Redireciona não-logado para login
  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Driver tenta acessar painel admin
  if (isLoggedIn && role === 'driver' && !pathname.startsWith(DRIVER_HOME)) {
    return NextResponse.redirect(new URL(DRIVER_HOME, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|icons).*)'],
};
