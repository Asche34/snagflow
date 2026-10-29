'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@snagflow/shared';
import { AUTH_COOKIE_NAME } from './cookie-name';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { name: AUTH_COOKIE_NAME, path: '/' } },
  );
}
