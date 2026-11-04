import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@snagflow/shared/db-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Persistence } from '../src/lib/offline/store';
import { OfflineEngine, type Mirror, type OfflineOperation } from '../src/lib/offline/engine';
import { bindOffline, offlineFor, OfflineRuntime, revokeOffline } from '../src/lib/offline/runtime';
import { uploadPhotos, type QueuedPhoto } from '../src/lib/photos';
import { assignSnag, transitionSnag, updateSnag } from '../src/lib/mutations';

const environment = vi.hoisted(() => ({
  client: null as unknown,
  user: '33333333-3333-4333-8333-333333333333',
  deployment: '',
  session: null as null | (() => Promise<unknown>),
  scoped: null as unknown,
  options: null as unknown,
  saved: new Map<string, unknown>(),
}));
vi.mock('../src/lib/supabase', () => ({
  get supabase() {
    return environment.client;
  },
  isCurrentClient: (client: unknown) => client === environment.client,
  getDeploymentKey: () => environment.deployment,
  getActiveConnection: () => ({
    supabaseUrl: 'https://api.example.test',
    supabaseAnonKey: 'public-test-key',
  }),
}));
vi.mock('../src/lib/offline/persistence', () => ({
  persistence: async () => ({
    read: async (scope: string) => structuredClone(environment.saved.get(scope) ?? null),
    write: async (scope: string, value: unknown) => {
      environment.saved.set(scope, structuredClone(value));
    },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: unknown) => {
    environment.options = options;
    return environment.scoped;
  },
}));
vi.mock('expo-crypto', async () => {
  const crypto = await import('node:crypto');
  return {
    randomUUID: crypto.randomUUID,
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digestStringAsync: async (_algorithm: string, value: string) =>
      crypto.createHash('sha256').update(value).digest('hex'),
  };
});
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-file-system', () => ({
  File: class {
    async arrayBuffer() {
      return new Uint8Array([1, 2, 3]).buffer;
    }
  },
}));
vi.mock('../src/lib/offline/files', () => ({
  persistPhotos: async (_scope: string, photos: unknown) => structuredClone(photos),
}));

type Client = SupabaseClient<Database>;
const projectId = '10101010-1010-4101-8101-101010101010';
const snagId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const baseTime = '2026-11-04T10:00:00.000Z';
const newerTime = '2026-11-04T11:00:00.000Z';
const session = () => ({
  data: { session: { user: { id: environment.user }, access_token: `jwt-${environment.user}` } },
  error: null,
});
const mirror = (): Mirror =>
  ({
    project: { id: projectId, status: 'active', name: 'Local project' },
    members: [],
    locations: [],
    categories: [],
    photos: [],
    comments: [],
    activity: [],
    synced_at: baseTime,
    snags: [
      {
        id: snagId,
        client_id: snagId,
        project_id: projectId,
        title: 'Initial title',
        priority: 'medium',
        status: 'open',
        deleted_at: null,
        updated_at: baseTime,
        created_by: environment.user,
      },
    ],
  }) as unknown as Mirror;
const memory: Persistence = { read: async () => null, write: async () => {} };
const operation = (kind: OfflineOperation['kind'] = 'comment'): OfflineOperation => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  projectId,
  snagId,
  kind,
  payload: { body: 'Retained comment' },
  expectedUpdatedAt: baseTime,
  state: 'queued',
  attempts: 0,
  createdAt: 1,
  nextAttemptAt: 0,
});
const photo = (): QueuedPhoto => ({
  id: snagId,
  thumbnailId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  originalUri: 'file:///private/original.jpg',
  thumbnailUri: 'file:///private/thumb.jpg',
  width: 100,
  height: 80,
  kind: 'fix',
  takenAt: baseTime,
  status: 'queued',
});
function projectsQuery() {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    maybeSingle: async () => ({ data: { id: projectId, status: 'active' }, error: null }),
    range: async () => ({ data: [{ id: projectId, status: 'active' }], error: null }),
  };
  return q;
}
function profileQuery() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { id: environment.user, is_active: true }, error: null }),
      }),
    }),
  };
}
async function boundRuntime() {
  const runtime = await bindOffline(environment.client as Client, environment.user);
  runtime.engine.state.mirrors[projectId] = mirror();
  vi.spyOn(runtime, 'sync').mockResolvedValue();
  return runtime;
}
let sequence = 0;
beforeEach(() => {
  revokeOffline();
  environment.deployment = `runtime-test-${++sequence}`;
  environment.user = '33333333-3333-4333-8333-333333333333';
  environment.session = null;
  environment.client = {
    auth: {
      getSession: () => (environment.session ? environment.session() : Promise.resolve(session())),
      getUser: async () => ({ data: { user: { id: environment.user } }, error: null }),
    },
  };
  environment.scoped = {};
  environment.options = null;
});

describe('offline runtime recovery boundaries', () => {
  it('invalidates a cached flattened image when the server has a different immutable annotation path', () => {
    const engine = new OfflineEngine(memory, 'photo-cache-version');
    engine.state.mirrors[projectId] = mirror();
    engine.state.mirrors[projectId]!.photos = [
      { id: snagId, annotated_path: 'project/snag/new.jpg' },
    ] as Mirror['photos'];
    engine.state.files = {
      [snagId]: { originalUri: 'file:///original.jpg', flattenedUri: 'file:///old-markup.jpg' },
    };
    const runtime = new OfflineRuntime(environment.client as Client, environment.user, engine);
    expect(runtime.photoUri(snagId)).toBeUndefined();
    expect(runtime.photoUri(snagId, true)).toBe('file:///original.jpg');
    engine.state.files[snagId] = {
      originalUri: 'file:///original.jpg',
      flattenedUri: 'file:///new-markup.jpg',
      annotatedPath: 'project/snag/new.jpg',
    };
    expect(runtime.photoUri(snagId)).toBe('file:///new-markup.jpg');
  });
  it('recognizes a schema17 server without treating reachable online APIs as offline', async () => {
    environment.scoped = {
      from: (table: string) => (table === 'profiles' ? profileQuery() : projectsQuery()),
      rpc: async () => ({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find public.mobile_sync_snapshot' },
      }),
    };
    const runtime = new OfflineRuntime(
      environment.client as Client,
      environment.user,
      new OfflineEngine(memory, 'legacy-capability'),
    );
    await runtime.sync();
    expect(runtime.capability).toBe('unsupported');
    expect(runtime.online).toBe(true);
    expect(runtime.error).toBe(
      'Offline sync needs a server update. Online changes remain available.',
    );
  });
  it('retains an ambiguous committed gateway failure under its original replay identity', async () => {
    const engine = new OfflineEngine(memory, 'ambiguous');
    await engine.enqueue(operation());
    await engine.flush(
      async () => {
        throw { code: '500', message: 'Internal Server Error' };
      },
      () => true,
      1,
    );
    expect(engine.state.queue[0]?.state).toBe('queued');
    const original = structuredClone(engine.state.queue[0]);
    await engine.retry(operation().id);
    expect(engine.state.queue[0]).toMatchObject({
      id: original?.id,
      payload: original?.payload,
      expectedUpdatedAt: original?.expectedUpdatedAt,
    });
  });

  it('does not publish an earlier delayed bind over the current same-account runtime', async () => {
    let release: ((value: unknown) => void) | undefined;
    let calls = 0;
    environment.session = () =>
      ++calls === 1
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.resolve(session());
    const first = bindOffline(environment.client as Client, environment.user).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const current = await bindOffline(environment.client as Client, environment.user);
    release!(session());
    const earlier = await first;
    expect('error' in earlier).toBe(true);
    expect(offlineFor(environment.client as Client)).toBe(current);
    expect(current.active).toBe(true);
  });

  it('queues continuous capture photos under a separate stable batch identity', async () => {
    const runtime = await boundRuntime();
    runtime.engine.state.mirrors[projectId]!.snags = [];
    await runtime.queue(
      'create',
      projectId,
      snagId,
      { title: 'Continuous capture', priority: 'medium' },
      snagId,
    );
    await uploadPhotos(projectId, snagId, [photo()], () => {}, 0, environment.client as Client);
    expect(runtime.engine.state.queue.map((q) => q.kind)).toEqual(['create', 'photos']);
    const batch = runtime.engine.state.queue[1]!;
    expect(batch.id).not.toBe(snagId);
    expect(batch.photos?.[0]?.id).toBe(snagId);
    await uploadPhotos(projectId, snagId, [photo()], () => {}, 0, environment.client as Client);
    expect(runtime.engine.state.queue).toHaveLength(2);
    expect(runtime.engine.state.queue[1]?.id).toBe(batch.id);
  });

  it('diffs a stale edit form against its captured base and retains that server version', async () => {
    const runtime = await boundRuntime();
    const base = structuredClone(runtime.engine.state.mirrors[projectId]!.snags[0]!);
    const current = runtime.engine.state.mirrors[projectId]!.snags[0]!;
    current.title = 'Remote newer title';
    current.updated_at = newerTime;
    await updateSnag(
      snagId,
      { title: base.title, priority: 'high' },
      environment.client as Client,
      base,
    );
    expect(runtime.engine.state.queue).toHaveLength(1);
    expect(runtime.engine.state.queue[0]).toMatchObject({
      kind: 'edit',
      payload: { priority: 'high' },
      expectedUpdatedAt: baseTime,
    });
    expect(runtime.engine.state.queue[0]!.payload).not.toHaveProperty('title');
    expect(runtime.detail(snagId).snag.title).toBe('Remote newer title');
  });

  it('keeps durable pending fix evidence available to the offline review workflow', async () => {
    const runtime = await boundRuntime();
    await uploadPhotos(projectId, snagId, [photo()], () => {}, 0, environment.client as Client);
    expect(runtime.detail(snagId).photos.filter((p) => p.kind === 'fix')).toHaveLength(1);
    expect(runtime.photoUri(snagId)).toBe('file:///private/original.jpg');
  });

  it('keeps the displayed workflow version when background sync has a newer assignment', async () => {
    const runtime = await boundRuntime();
    const current = runtime.engine.state.mirrors[projectId]!.snags[0]!;
    current.updated_at = newerTime;
    current.assignee_id = '44444444-4444-4444-8444-444444444444';
    await assignSnag(snagId, environment.user, environment.client as Client, baseTime);
    await transitionSnag(snagId, 'in_progress', '', environment.client as Client, baseTime);
    expect(runtime.engine.state.queue.map((q) => q.kind)).toEqual(['assign', 'transition']);
    for (const q of runtime.engine.state.queue) expect(q.expectedUpdatedAt).toBe(baseTime);
  });

  it('retains an acknowledged comment locally when the following pull is interrupted', async () => {
    const engine = new OfflineEngine(memory, 'acknowledged-comment');
    engine.state.mirrors[projectId] = mirror();
    const op = operation();
    await engine.enqueue(op);
    const comment = {
      id: op.id,
      snag_id: snagId,
      author_id: environment.user,
      body: op.payload.body,
      created_at: baseTime,
    };
    environment.scoped = {
      from: (table: string) => {
        if (table === 'profiles') return profileQuery();
        const q = projectsQuery();
        q.range = async () => {
          throw new TypeError('Network request failed after comment acknowledgement');
        };
        return q;
      },
      rpc: async () => ({
        data: { snag: mirror().snags[0], comment, skipped_fields: [] },
        error: null,
      }),
    };
    const runtime = new OfflineRuntime(environment.client as Client, environment.user, engine);
    await runtime.sync();
    expect(engine.state.queue).toEqual([]);
    expect(runtime.detail(snagId).comments).toContainEqual(comment);
    expect(runtime.online).toBe(false);
  });

  it('purges a definitively denied snapshot and project/snag drafts while preserving queued intent', async () => {
    const client = environment.client as Client;
    Object.assign(client, { from: projectsQuery });
    const engine = new OfflineEngine(memory, 'denied');
    engine.state.mirrors[projectId] = mirror();
    await engine.setDraft(`capture:${projectId}`, { title: 'Unsent private capture' });
    await engine.setDraft(`edit:${snagId}`, { title: 'Private edit' });
    const intent = operation();
    intent.state = 'attention';
    await engine.enqueue(intent);
    environment.scoped = {
      from: (table: string) => (table === 'profiles' ? profileQuery() : projectsQuery()),
      rpc: async () => ({
        data: null,
        error: { code: '42501', message: 'OFFLINE_FORBIDDEN: access removed' },
      }),
    };
    const runtime = new OfflineRuntime(client, environment.user, engine);
    await runtime.sync();
    expect(engine.state.mirrors[projectId]).toBeUndefined();
    expect(engine.state.drafts[`capture:${projectId}`]).toBeUndefined();
    expect(engine.state.drafts[`edit:${snagId}`]).toBeUndefined();
    expect(engine.state.queue[0]).toMatchObject({
      id: intent.id,
      payload: intent.payload,
      state: 'attention',
    });
  });

  it('pins an interrupted photo upload to its original account and stops the chain on revocation', async () => {
    type PinnedOptions = { accessToken: () => Promise<string>; global: { fetch: typeof fetch } };
    let finish: (() => void) | undefined;
    const sentTokens: string[] = [];
    const upload = async () => {
      const options = environment.options as PinnedOptions;
      const token = await options.accessToken();
      await options.global.fetch('https://api.example.test/storage/upload', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { error: null };
    };
    const nativeFetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      sentTokens.push(new Headers(init?.headers).get('Authorization') ?? '');
      return new Promise<Response>((resolve) => {
        finish = () => resolve(new Response('', { status: 200 }));
      });
    });
    vi.stubGlobal('fetch', nativeFetch);
    const engine = new OfflineEngine(memory, 'account-pin');
    engine.state.mirrors[projectId] = mirror();
    await engine.enqueue({
      ...operation('photos'),
      payload: { photo_ids: [snagId] },
      photos: [photo()],
    });
    environment.scoped = {
      from: (table: string) =>
        table === 'profiles'
          ? profileQuery()
          : table === 'projects'
            ? projectsQuery()
            : {
                select: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                }),
              },
      storage: { from: () => ({ upload, info: upload }) },
    };
    const runtime = new OfflineRuntime(environment.client as Client, environment.user, engine);
    const syncing = runtime.sync();
    try {
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      environment.user = '44444444-4444-4444-8444-444444444444';
      runtime.active = false;
      finish!();
      await syncing;
      expect(sentTokens).toEqual(['Bearer jwt-33333333-3333-4333-8333-333333333333']);
      expect(nativeFetch).toHaveBeenCalledTimes(1);
      expect(engine.state.queue).toHaveLength(1);
      expect(engine.state.queue[0]?.photos?.[0]?.originalUri).toBe('file:///private/original.jpg');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
