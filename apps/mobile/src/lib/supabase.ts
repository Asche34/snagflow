import { createClient } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared/db-types';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createChunkedStorage, type SessionStorage } from './session-storage';
import { MobileConnectionSchema, type MobileConnection } from '@snagflow/shared';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { connectionStorageKey, revocableStorage, guardedFetch } from './connection';

export let supabaseSetupError: string | null =
  'Enter your SnagFlow app URL and tap Connect before signing in.';
export function defaultConnection(): MobileConnection | null {
  const parsed = MobileConnectionSchema.safeParse({
    application: 'SnagFlow',
    version: 1,
    appUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}

const nativeStorage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});

// Browser sessions last for this tab; SSR never reads browser globals.
const webStorage: SessionStorage = {
  getItem: async (key) =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(key),
  setItem: async (key, value) => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
  },
};

const storage = Platform.OS === 'web' ? webStorage : nativeStorage;
export const connectionPreferencesStorage = storage;
let activeConnection: MobileConnection | null = null;
let activeStorageKey: string | null = null;
let deactivateStorage: (() => void) | null = null;
// Imports remain safe before configuration; this inert client cannot persist or refresh sessions.
export let supabase = createClient<Database>('http://127.0.0.1:1', 'unconfigured', {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
export function getApiBaseUrl(): string {
  return activeConnection?.appUrl ?? '';
}
export function isCurrentClient(client: typeof supabase): boolean {
  return client === supabase && activeStorageKey !== null;
}
let pendingInstallation: Promise<unknown> = Promise.resolve();
export function installConnection(value: MobileConnection, resetSession = false): Promise<string> {
  const result = pendingInstallation.then(() => performInstallation(value, resetSession));
  pendingInstallation = result.catch(() => {});
  return result;
}
async function performInstallation(
  value: MobileConnection,
  resetSession: boolean,
): Promise<string> {
  const next = MobileConnectionSchema.parse(value);
  const key = await connectionStorageKey(next, (text) =>
    digestStringAsync(CryptoDigestAlgorithm.SHA256, text),
  );
  if (activeStorageKey === key && !resetSession) return key;
  const previous = supabase;
  const previousKey = activeStorageKey;
  activeStorageKey = null;
  activeConnection = null;
  supabaseSetupError = 'Reconnect to your SnagFlow app before signing in.';
  deactivateStorage?.();
  deactivateStorage = null;
  await previous.auth.stopAutoRefresh();
  await previous.removeAllChannels();
  if (previousKey) {
    await storage.removeItem(previousKey);
    await storage.removeItem(`${previousKey}-code-verifier`);
  }
  if (resetSession && previousKey !== key) {
    await storage.removeItem(key);
    await storage.removeItem(`${key}-code-verifier`);
  }
  const guarded = revocableStorage(storage);
  supabase = createClient<Database>(next.supabaseUrl, next.supabaseAnonKey, {
    global: { fetch: guardedFetch(fetch, guarded.isActive) },
    auth: {
      storage: guarded.storage,
      storageKey: key,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  activeConnection = next;
  activeStorageKey = key;
  deactivateStorage = guarded.deactivate;
  supabaseSetupError = null;
  return key;
}
