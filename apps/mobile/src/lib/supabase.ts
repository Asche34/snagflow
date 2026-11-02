import { createClient } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared/db-types';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createChunkedStorage, type SessionStorage } from './session-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let validUrl = false;
try {
  validUrl = !!url && ['https:', 'http:'].includes(new URL(url).protocol);
} catch {
  /* Setup is rendered by the provider. */
}
export const supabaseSetupError =
  !validUrl || !anonKey
    ? 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env, then restart Expo. Use the public anon key for the same Supabase project as the web app.'
    : null;

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

// An inert client keeps imports safe before environment setup; the provider blocks all screens.
export const supabase = createClient<Database>(
  validUrl ? url! : 'http://127.0.0.1:1',
  anonKey || 'unconfigured',
  {
    auth: {
      storage: Platform.OS === 'web' ? webStorage : nativeStorage,
      autoRefreshToken: !supabaseSetupError,
      persistSession: !supabaseSetupError,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);
