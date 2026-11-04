import {
  AppUrlSchema,
  MobileConnectionSchema,
  MobilePublicConfigSchema,
  type MobileConnection,
} from '@snagflow/shared';
import type { SessionStorage } from './session-storage';
const scopedClients = new WeakMap<
  object,
  { origin: unknown; active: () => boolean; actor?: string }
>();
export function registerScopedClient(
  client: object,
  origin: unknown,
  active: () => boolean,
  actor?: string,
) {
  scopedClients.set(client, { origin, active, actor });
}
export function scopedActor(client: object): string | null {
  const scope = scopedClients.get(client);
  return scope?.active() ? (scope.actor ?? null) : null;
}
export function assertConnectionClient(expected: unknown, current: unknown): void {
  if (expected === current) return;
  const scoped = typeof expected === 'object' && expected ? scopedClients.get(expected) : undefined;
  if (!scoped || scoped.origin !== current || !scoped.active())
    throw Error('The app connection changed. Retry in the selected app.');
}
export function guardedFetch(fetcher: typeof fetch, active: () => boolean): typeof fetch {
  return async (input, options) => {
    if (!active()) throw Error('The app connection changed. Retry in the selected app.');
    const response = await fetcher(input, options);
    if (!active()) throw Error('The app connection changed. Retry in the selected app.');
    return response;
  };
}

export async function connectionStorageKey(
  value: Pick<MobileConnection, 'appUrl' | 'supabaseUrl' | 'supabaseAnonKey'>,
  digest: (value: string) => Promise<string>,
): Promise<string> {
  const hash = await digest(
    JSON.stringify([value.appUrl, value.supabaseUrl, value.supabaseAnonKey]),
  );
  if (!/^[a-f0-9]{64}$/i.test(hash))
    throw Error('Secure session storage is unavailable on this device.');
  return `snagflow.auth.${hash}`;
}
export function revocableStorage(backend: SessionStorage): {
  storage: SessionStorage;
  deactivate: () => void;
  isActive: () => boolean;
} {
  let active = true;
  return {
    deactivate: () => {
      active = false;
    },
    isActive: () => active,
    storage: {
      getItem: (key) => (active ? backend.getItem(key) : Promise.resolve(null)),
      setItem: (key, value) => (active ? backend.setItem(key, value) : Promise.resolve()),
      removeItem: (key) => (active ? backend.removeItem(key) : Promise.resolve()),
    },
  };
}

/** Public discovery never carries cookies, prior bearer tokens or user credentials. */
export async function discoverConnection(
  appUrl: string,
  fetcher?: typeof fetch,
): Promise<MobileConnection> {
  const parsedOrigin = AppUrlSchema.safeParse(appUrl);
  if (!parsedOrigin.success)
    throw Error(parsedOrigin.error.issues[0]?.message ?? 'Enter a valid app URL.');
  const origin = parsedOrigin.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    // Expo's native transport enforces redirect policy; legacy RN XHR fetch may not.
    const transport = fetcher ?? (await import('expo/fetch')).fetch;
    const response = await transport(`${origin}/api/mobile-config`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok)
      throw Error(
        'This address did not provide SnagFlow connection settings. Check the address and server setup.',
      );
    const text = await response.text();
    if (text.length > 16384) throw Error('The server returned invalid connection settings.');
    const config = MobilePublicConfigSchema.safeParse(JSON.parse(text));
    if (!config.success)
      throw Error(
        'This is not a compatible SnagFlow server, or its public connection settings are invalid.',
      );
    const connection = MobileConnectionSchema.safeParse({ ...config.data, appUrl: origin });
    if (!connection.success)
      throw Error(
        connection.error.issues[0]?.message ?? 'The backend address is unavailable to this device.',
      );
    const probe = await transport(`${connection.data.supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { apikey: connection.data.supabaseAnonKey, Accept: 'application/json' },
    });
    if (!probe.ok)
      throw Error(
        'The app was found, but its backend is unavailable. Check the server and Wi-Fi connection.',
      );
    return connection.data;
  } catch (error) {
    if (error instanceof Error && !['AbortError', 'TypeError', 'SyntaxError'].includes(error.name))
      throw error;
    throw Error('Could not connect. Check the app address, Wi-Fi and server, then retry.');
  } finally {
    clearTimeout(timeout);
  }
}
