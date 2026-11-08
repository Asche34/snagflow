import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type Session } from '@supabase/supabase-js';
import { OfflineSessionRecovery } from '../src/lib/offline-session';
import { OfflineEngine } from '../src/lib/offline/engine';

const actor = '33333333-3333-4333-8333-333333333333';
const expired = (): Session => ({
  access_token: 'isolated-fake-access',
  refresh_token: 'isolated-fake-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) - 3600,
  user: {
    id: actor,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
});
const retryable = { name: 'AuthRetryableFetchError', status: 0, message: 'Offline transport' };
afterEach(() => vi.restoreAllMocks());
function setup() {
  const state = {
    namespace: 'deployment-A',
    active: true,
    stored: expired() as unknown,
    profile: { id: actor, is_active: true } as { id: string; is_active: boolean } | null,
  };
  const recovery = new OfflineSessionRecovery('deployment-A', {
    namespace: () => state.namespace,
    active: () => state.active,
    readStored: async () => state.stored,
    profile: async () => state.profile,
  });
  return { state, recovery };
}
describe('retained local identity after access-token expiry', () => {
  it('allows only matching verified local profile after a retryable refresh failure', async () => {
    const { recovery } = setup();
    expect(await recovery.recover(retryable, actor)).toMatchObject({ user: { id: actor } });
    expect(recovery.local(actor)?.user.id).toBe(actor);
    expect(recovery.local('44444444-4444-4444-8444-444444444444')).toBeNull();
  });
  it('rejects invalid credentials, inactive/missing profiles, malformed sessions and another namespace', async () => {
    for (const failure of [
      { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' },
      new TypeError('Storage read failed'),
    ]) {
      const { recovery } = setup();
      expect(await recovery.recover(failure, actor)).toBeNull();
    }
    for (const change of [
      (s: ReturnType<typeof setup>['state']) => {
        s.profile = null;
      },
      (s: ReturnType<typeof setup>['state']) => {
        s.profile = { id: actor, is_active: false };
      },
      (s: ReturnType<typeof setup>['state']) => {
        s.profile = { id: 'other', is_active: true };
      },
      (s: ReturnType<typeof setup>['state']) => {
        s.stored = { user: { id: actor } };
      },
      (s: ReturnType<typeof setup>['state']) => {
        s.namespace = 'deployment-B';
      },
    ]) {
      const { state, recovery } = setup();
      change(state);
      expect(await recovery.recover(retryable, actor)).toBeNull();
    }
  });
  it('cannot publish delayed A recovery after B signs in, signout or deployment switching', async () => {
    for (const action of ['signout', 'account', 'deployment']) {
      let release: ((value: unknown) => void) | undefined;
      let namespace = 'deployment-A';
      const recovery = new OfflineSessionRecovery('deployment-A', {
        namespace: () => namespace,
        active: () => true,
        readStored: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
        profile: async () => ({ id: actor, is_active: true }),
      });
      const recovering = recovery.recover(retryable, actor);
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      if (action === 'signout') recovery.revoke();
      else if (action === 'account')
        recovery.accept({
          ...expired(),
          user: { ...expired().user, id: '44444444-4444-4444-8444-444444444444' },
        });
      else namespace = 'deployment-B';
      release!(expired());
      expect(await recovering).toBeNull();
      expect(recovery.local(actor)).toBeNull();
    }
  });
  it('uses the actual installed SDK null-session network failure without persisting tokens into local data', async () => {
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const key = 'isolated-expired-session';
    const retained = expired();
    const values = new Map([[key, JSON.stringify(retained)]]);
    let reachable = false;
    let refreshRequests = 0;
    const client = createClient('https://offline.example.invalid', 'fake-public-key', {
      global: {
        fetch: async () => {
          refreshRequests++;
          if (reachable)
            return new Response(
              JSON.stringify({
                ...retained,
                access_token: 'isolated-fresh-access',
                refresh_token: 'isolated-rotated-refresh',
                expires_at: Math.floor(clock / 1000) + 3600,
                expires_in: 3600,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          clock += 31000;
          throw new TypeError('Offline transport');
        },
      },
      auth: {
        storageKey: key,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async (k) => values.get(k) ?? null,
          setItem: async (k, v) => {
            values.set(k, v);
          },
          removeItem: async (k) => {
            values.delete(k);
          },
        },
      },
    });
    try {
      const result = await client.auth.getSession();
      expect(result.data.session).toBeNull();
      expect(result.error?.name).toBe('AuthRetryableFetchError');
      expect(values.has(key)).toBe(true);
      const recovery = new OfflineSessionRecovery(key, {
        namespace: () => key,
        active: () => true,
        readStored: async () => JSON.parse(values.get(key)!),
        profile: async () => ({ id: actor, is_active: true }),
      });
      expect((await recovery.recover(result.error, actor))?.user.id).toBe(actor);
      const storedBefore = values.get(key);
      recovery.revoke();
      expect(recovery.local(actor)).toBeNull();
      expect(await recovery.recover(result.error, actor)).toBeNull();
      expect(values.get(key)).toBe(storedBefore);
      // The installed SDK intentionally caches a retryable refresh failure for
      // 60 seconds. Reconnect cannot force getSession() past that public policy.
      const engine = new OfflineEngine(
        { read: async () => null, write: async () => {} },
        'cooldown-probe',
      );
      await engine.enqueue({
        id: 'stable-operation',
        projectId: 'project',
        snagId: 'snag',
        kind: 'comment',
        payload: { body: 'Retain during refresh backoff' },
        expectedUpdatedAt: null,
        state: 'queued',
        attempts: 0,
        nextAttemptAt: 0,
        createdAt: clock,
      });
      reachable = true;
      const requestsAtReconnect = refreshRequests;
      const coolingDown = await client.auth.getSession();
      expect(coolingDown.data.session).toBeNull();
      expect(coolingDown.error?.name).toBe('AuthRetryableFetchError');
      expect(refreshRequests).toBe(requestsAtReconnect);
      expect(engine.state.queue[0]?.attempts).toBe(0);
      clock += 61000;
      const refreshed = await client.auth.getSession();
      expect(refreshed.error).toBeNull();
      expect(refreshed.data.session?.access_token).toBe('isolated-fresh-access');
      expect(refreshRequests).toBe(requestsAtReconnect + 1);
      const replayed: string[] = [];
      await engine.flush(
        async (op) => {
          const current = await client.auth.getSession();
          expect(current.error).toBeNull();
          expect(current.data.session!.expires_at! * 1000).toBeGreaterThan(clock);
          replayed.push(op.id);
        },
        () => true,
        clock,
      );
      expect(replayed).toEqual(['stable-operation']);
      expect(engine.state.queue).toEqual([]);
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
});
