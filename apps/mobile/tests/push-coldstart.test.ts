import { expect, it, vi } from 'vitest';
import { installConnection, getDeploymentKey } from '../src/lib/supabase';
const os = vi.hoisted(() => ({
  response: { notification: 'launch-tap' } as unknown,
  clears: 0,
  dismisses: 0,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => ({
  clearLastNotificationResponse: () => {
    os.clears++;
    os.response = null;
  },
  dismissAllNotificationsAsync: async () => {
    os.dismisses++;
  },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
vi.mock('expo-crypto', async () => {
  const crypto = await import('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'sha256' },
    digestStringAsync: async (_algorithm: string, text: string) =>
      crypto.createHash('sha256').update(text).digest('hex'),
  };
});
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { stopAutoRefresh: async () => {} },
    removeAllChannels: async () => {},
  }),
}));
vi.mock('../src/lib/offline/runtime', () => ({ revokeOffline: () => {} }));

it('retains a cold-start OS tap until validated navigation, but clears taps on real deployment switch and logout', async () => {
  const connection = {
    application: 'SnagFlow' as const,
    version: 1 as const,
    appUrl: 'https://app.example.test',
    supabaseUrl: 'https://backend.example.test',
    supabaseAnonKey: 'sb_publishable_fake_public_test_key',
  };
  expect(getDeploymentKey()).toBeNull();
  await installConnection(connection);
  expect(os.response).toEqual({ notification: 'launch-tap' });
  expect(os.clears).toBe(0);
  expect(os.dismisses).toBe(0);
  await installConnection({ ...connection, appUrl: 'https://other.example.test' });
  expect(os.response).toBeNull();
  expect(os.clears).toBe(1);
  expect(os.dismisses).toBe(1);
  os.response = { notification: 'old-account-tap' };
  await installConnection({ ...connection, appUrl: 'https://other.example.test' }, true);
  expect(os.response).toBeNull();
  expect(os.clears).toBe(2);
  expect(os.dismisses).toBe(2);
});
