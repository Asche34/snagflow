import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared';
import { getSupabaseServerUrl } from '@/lib/env';

/** Auth administration only. Never import this module into a client component. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Invitation service is not configured');
  return createClient<Database>(getSupabaseServerUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function invitationOrigin() {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error('Invitation origin is not configured');
  const url = new URL(configured);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
  )
    throw new Error('Invitation origin is invalid');
  return url.origin;
}
