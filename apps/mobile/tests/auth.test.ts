import { describe, expect, it } from 'vitest';
import { createChunkedStorage } from '../src/lib/session-storage';
import {
  clearAuthCallbackState,
  exchangeAuthCallback,
  parseAuthCallback,
  retainedAuthProfile,
  safeReturnPath,
} from '../src/lib/auth-callback';
import { AccessUnavailableError } from '../src/lib/online';

function secureMemory() {
  const values = new Map<string, string>();
  let failWrites = false;
  return {
    values,
    fail: () => {
      failWrites = true;
    },
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (failWrites) throw new Error('keychain unavailable');
      if (new TextEncoder().encode(value).length > 2000) throw new Error('too large');
      // A native UTF-8 store cannot round-trip isolated UTF-16 surrogates.
      values.set(key, new TextDecoder().decode(new TextEncoder().encode(value)));
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}

describe('persistent session storage', () => {
  it('round trips a large unicode session within native keychain value limits', async () => {
    const backend = secureMemory();
    const storage = createChunkedStorage(backend);
    const session = JSON.stringify({ refresh_token: 'abc'.repeat(3000), name: '🏗️'.repeat(600) });
    await storage.setItem('sb-test-auth-token', session);
    expect(await createChunkedStorage(backend).getItem('sb-test-auth-token')).toBe(session);
  });
  it('removes old fragments when replacing and signing out', async () => {
    const backend = secureMemory();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'a'.repeat(9000));
    await storage.setItem('session', 'short');
    expect(await storage.getItem('session')).toBe('short');
    expect(backend.values.size).toBe(2);
    await storage.removeItem('session');
    expect(backend.values.size).toBe(0);
    expect(await storage.getItem('session')).toBeNull();
  });
  it('preserves the previous committed session after a failed keychain write', async () => {
    const backend = secureMemory();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'previous');
    backend.fail();
    await expect(storage.setItem('session', 'new')).rejects.toThrow();
    expect(await storage.getItem('session')).toBe('previous');
  });
  it('fails closed when a committed fragment is missing', async () => {
    const backend = secureMemory();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'a'.repeat(9000));
    const fragment = [...backend.values.keys()].find((key) => key !== 'session')!;
    backend.values.delete(fragment);
    expect(await storage.getItem('session')).toBeNull();
  });
});

describe('authentication deep links', () => {
  it('exchanges a one-use code once when an account change remounts its route', async () => {
    let requests = 0;
    const exchange = async (code: string) => {
      expect(code).toBe('unique-one-use');
      ++requests;
      return { error: null };
    };
    await Promise.all([
      exchangeAuthCallback('snagflow://auth/callback?code=unique-one-use', exchange),
      exchangeAuthCallback('snagflow://auth/callback?code=unique-one-use', exchange),
    ]);
    expect(requests).toBe(1);
  });
  it('never exchanges a code from an untrusted callback origin', async () => {
    let requests = 0;
    await expect(
      exchangeAuthCallback(
        'https://evil.test/auth/callback?code=stolen',
        async () => {
          ++requests;
          return { error: null };
        },
        'https://app.test',
      ),
    ).rejects.toThrow();
    expect(requests).toBe(0);
  });
  it('does not reuse a completed callback exchange after signing out', async () => {
    let requests = 0;
    const exchange = async () => {
      ++requests;
      return { error: null };
    };
    await exchangeAuthCallback('snagflow://auth/callback?code=expired-after-signout', exchange);
    clearAuthCallbackState();
    await exchangeAuthCallback('snagflow://auth/callback?code=expired-after-signout', exchange);
    expect(requests).toBe(2);
  });
  it('accepts only the registered native callback or the same web origin', () => {
    expect(parseAuthCallback('snagflow://auth/callback?code=one-use')).toEqual({ code: 'one-use' });
    expect(
      parseAuthCallback('https://app.test/auth/callback?code=one-use', 'https://app.test'),
    ).toEqual({ code: 'one-use' });
    for (const url of [
      'https://evil.test/auth/callback?code=stolen',
      'snagflow://evil/callback?code=stolen',
      'snagflow://auth/callback/extra?code=stolen',
      'snagflow://user@auth/callback?code=stolen',
      'snagflow://auth/callback?code=one&code=two',
      'snagflow://auth/callback#access_token=secret&refresh_token=secret',
    ])
      expect(() => parseAuthCallback(url, 'https://app.test')).toThrow();
  });
  it('shows safe recovery guidance without exposing provider tokens or error text', () => {
    expect(() =>
      parseAuthCallback(
        'snagflow://auth/callback?error=access_denied&error_description=secret-token',
      ),
    ).toThrow('Request a new sign-in link');
  });
  it('returns to known private app paths while rejecting external and callback redirects', () => {
    expect(safeReturnPath('/snags/11111111-1111-4111-8111-111111111111')).toBe(
      '/snags/11111111-1111-4111-8111-111111111111',
    );
    expect(safeReturnPath('/projects/11111111-1111-4111-8111-111111111111')).toBe(
      '/projects/11111111-1111-4111-8111-111111111111',
    );
    for (const path of [
      '//evil.test',
      'https://evil.test',
      '/auth/callback?code=secret',
      '/login',
      '/snags/../login',
      '/snags/%2f%2fevil.test',
    ]) {
      expect(safeReturnPath(path)).toBe('/');
    }
  });
});

describe('foreground account refresh', () => {
  const profile = {
    id: 'same-user',
    avatar_url: null,
    created_at: '2026-11-02T00:00:00Z',
    email: 'member@test.example',
    full_name: 'Member',
    is_admin: false,
    is_active: true,
  };
  it('keeps the verified same-user profile through a temporary camera-return network failure', () => {
    expect(retainedAuthProfile(profile, 'same-user', new TypeError('Network request failed'))).toBe(
      profile,
    );
  });
  it('clears the profile after a proven access loss or account change', () => {
    for (const error of [new AccessUnavailableError(), { code: '42501' }, { code: 'PGRST116' }]) {
      expect(retainedAuthProfile(profile, 'same-user', error)).toBeNull();
    }
    expect(
      retainedAuthProfile(profile, 'different-user', new TypeError('Network request failed')),
    ).toBeNull();
    expect(
      retainedAuthProfile(
        { ...profile, is_active: false },
        'same-user',
        new TypeError('Network request failed'),
      ),
    ).toBeNull();
    expect(
      retainedAuthProfile(null, 'same-user', new TypeError('Network request failed')),
    ).toBeNull();
  });
});
