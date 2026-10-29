import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@snagflow/shared';
import { getSupabaseAnonKey, getSupabaseServerUrl } from '@/lib/env';
import { AUTH_COOKIE_NAME } from '@/lib/supabase/cookie-name';

/**
 * Session refresh (Next 16 "proxy" — the successor of `middleware.ts`).
 *
 * Runs on every page request: it refreshes the Supabase session cookie when
 * the access token expired and sends anonymous visitors to the login screen.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(getSupabaseServerUrl(), getSupabaseAnonKey(), {
    cookieOptions: { name: AUTH_COOKIE_NAME, path: '/' },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token against the auth server. getClaims() would
  // need asymmetric signing keys, which the local stack does not use.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && pathname !== '/login' && !pathname.startsWith('/invite/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, Next internals, and the API surface — the health
    // endpoint must answer without a session cookie, and other routes under
    // /api own their own auth.
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
