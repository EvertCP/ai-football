import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(request) {
    const role = request.nextauth.token?.role || 'USER';
    const path = request.nextUrl.pathname;

    if (path.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (path.startsWith('/api/prediction/evaluate') && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Se requiere una cuenta ADMIN' }, { status: 403 });
    }
    if ((path.startsWith('/picks') || path.startsWith('/api/prediction') || path.startsWith('/api/player-picks')) && role === 'USER') {
      if (path.startsWith('/api/')) return NextResponse.json({ error: 'Se requiere una cuenta PRO' }, { status: 403 });
      return NextResponse.redirect(new URL('/', request.url));
    }
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
);

export const config = {
  matcher: [
    '/',
    '/competitions/:path*',
    '/competition/:path*',
    '/match/:path*',
    '/team/:path*',
    '/picks/:path*',
    '/admin/:path*',
    '/api/fixtures/:path*',
    '/api/leagues/:path*',
    '/api/teams/:path*',
    '/api/prediction/:path*',
    '/api/player-picks/:path*',
  ],
};
