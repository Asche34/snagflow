import type { Database } from '@snagflow/shared/db-types';
import { retainedResource } from './online';

export const AUTH_REDIRECT_URL = 'snagflow://auth/callback';

/** Preserve mounted drafts after transport failures, but never across account/access changes. */
export function retainedAuthProfile(
  previous: Database['public']['Tables']['profiles']['Row'] | null,
  userId: string,
  failure: unknown,
): Database['public']['Tables']['profiles']['Row'] | null {
  return retainedResource(previous?.id === userId && previous.is_active ? previous : null, failure);
}

export function parseAuthCallback(input: string, webOrigin?: string): { code: string } {
  const failure = 'Unable to use this sign-in link. Request a new sign-in link on this device.';
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(failure);
  }
  const native =
    url.protocol === 'snagflow:' &&
    url.hostname === 'auth' &&
    url.pathname === '/callback' &&
    !url.port;
  const web =
    !!webOrigin &&
    url.origin === webOrigin &&
    ['http:', 'https:'].includes(url.protocol) &&
    url.pathname === '/auth/callback';
  if (
    (!native && !web) ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.has('error') ||
    url.searchParams.has('access_token') ||
    url.searchParams.has('refresh_token')
  ) {
    throw new Error(failure);
  }
  const codes = url.searchParams.getAll('code');
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) throw new Error(failure);
  return { code: codes[0] };
}

export function safeReturnPath(path: string | undefined): string {
  if (
    !path ||
    path.includes('%') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#')
  )
    return '/';
  const uuid = '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}';
  return new RegExp(
    `^/(?:snags/${uuid}|projects/${uuid}(?:/(?:capture|reports))?|notifications)$`,
  ).test(path)
    ? path
    : '/';
}

let lastExchange: { code: string; result: Promise<void> } | undefined;
/** Account changes remount private navigation; do not consume a PKCE code twice. */
export async function exchangeAuthCallback(
  input: string,
  exchangeCode: (code: string) => Promise<{ error: { message: string } | null }>,
  webOrigin?: string,
): Promise<void> {
  const { code } = parseAuthCallback(input, webOrigin);
  if (lastExchange?.code === code) return lastExchange.result;
  const result = (async () => {
    const { error } = await exchangeCode(code);
    if (error)
      throw new Error(
        'Unable to use this sign-in link. Request a new sign-in link on this device.',
      );
  })();
  lastExchange = { code, result };
  return result;
}

let returnPath = '/';
export function rememberReturnPath(path: string | undefined) {
  returnPath = safeReturnPath(path);
}
export function consumeReturnPath() {
  const path = returnPath;
  returnPath = '/';
  return path;
}
export function clearAuthCallbackState() {
  lastExchange = undefined;
  returnPath = '/';
}
