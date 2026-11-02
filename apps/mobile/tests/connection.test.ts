import { describe, expect, it } from 'vitest';
import {
  discoverConnection,
  connectionStorageKey,
  revocableStorage,
  guardedFetch,
} from '../src/lib/connection';
const config = {
  application: 'SnagFlow',
  version: 1,
  supabaseUrl: 'https://backend.supabase.co',
  supabaseAnonKey: 'sb_publishable_unit_test_public_key_12345',
};
describe('deployment discovery', () => {
  it('sends no request after a connection is deactivated', async () => {
    let calls = 0;
    const transport = guardedFetch(
      async () => {
        calls++;
        return Response.json({});
      },
      () => false,
    );
    await expect(transport('https://old.example')).rejects.toThrow('connection changed');
    expect(calls).toBe(0);
  });
  it('rejects an in-flight old connection response before delivering it to a screen', async () => {
    let active = true,
      finish!: (response: Response) => void;
    const transport = guardedFetch(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      () => active,
    );
    const pending = transport('https://old.example');
    active = false;
    finish(Response.json({ private: 'old deployment' }));
    await expect(pending).rejects.toThrow('connection changed');
  });
  it('isolates sessions for two app origins even when they advertise the same backend', async () => {
    const { createHash } = await import('node:crypto');
    const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
    const first = await connectionStorageKey({ ...config, appUrl: 'https://one.example' }, digest);
    const second = await connectionStorageKey({ ...config, appUrl: 'https://two.example' }, digest);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^snagflow\.auth\.[0-9a-f]{64}$/);
  });
  it('deactivates old session storage so late refreshes cannot restore a switched-away session', async () => {
    const values = new Map<string, string>();
    const guarded = revocableStorage({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    });
    await guarded.storage.setItem('old', 'session');
    guarded.deactivate();
    await guarded.storage.setItem('old', 'late refresh');
    expect(values.get('old')).toBe('session');
    expect(await guarded.storage.getItem('old')).toBeNull();
  });
  it('fetches public configuration without old cookies or tokens and probes the backend before accepting', async () => {
    const requests: { url: string; options?: RequestInit }[] = [];
    const fetcher: typeof fetch = async (url, options) => {
      requests.push({ url: String(url), options });
      return Response.json(requests.length === 1 ? config : { external: {} });
    };
    expect((await discoverConnection('https://team.example/', fetcher)).appUrl).toBe(
      'https://team.example',
    );
    expect(requests.map((r) => r.url)).toEqual([
      'https://team.example/api/mobile-config',
      'https://backend.supabase.co/auth/v1/settings',
    ]);
    expect(requests[0]?.options).toMatchObject({ credentials: 'omit', redirect: 'error' });
    expect(new Headers(requests[0]?.options?.headers).has('Authorization')).toBe(false);
    expect(new Headers(requests[1]?.options?.headers).get('apikey')).toBe(config.supabaseAnonKey);
  });
  it('does not accept unrelated applications, unavailable backends or redirects', async () => {
    await expect(
      discoverConnection('https://team.example', async () =>
        Response.json({ application: 'Other' }),
      ),
    ).rejects.toThrow();
    let count = 0;
    await expect(
      discoverConnection('https://team.example', async () =>
        ++count === 1 ? Response.json(config) : new Response('', { status: 503 }),
      ),
    ).rejects.toThrow();
    await expect(
      discoverConnection(
        'https://team.example',
        async () =>
          new Response('', { status: 302, headers: { Location: 'https://other.example' } }),
      ),
    ).rejects.toThrow();
  });
});
