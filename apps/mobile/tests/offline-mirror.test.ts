import { describe, expect, it } from 'vitest';
import { applySnapshot, localSnags, type Snapshot } from '../src/lib/offline/mirror';
import type { Mirror, OfflineOperation, OfflineState } from '../src/lib/offline/engine';
const snag = {
  id: 's',
  client_id: 's',
  project_id: 'p',
  title: 'Remote',
  status: 'open',
  updated_at: '2026-11-01T00:00:00Z',
  deleted_at: null,
};
const mirror = {
  project: { id: 'p' },
  snags: [snag, { ...snag, id: 'deleted' }],
  members: [],
  locations: [],
  categories: [],
  photos: [],
  comments: [],
  activity: [],
  synced_at: 'old',
} as unknown as Mirror;
const state = (): OfflineState => ({
  version: 1,
  mirrors: { p: structuredClone(mirror) },
  drafts: {},
  queue: [],
  profile: null,
  lastSynced: null,
});
describe('offline mirror reconciliation', () => {
  it('merges deltas, removes absent IDs and preserves a tombstone without displaying deleted records', () => {
    const s = state();
    applySnapshot(s, {
      ...mirror,
      synced_at: 'new',
      snags: [{ ...snag, title: 'Changed', deleted_at: 'now' }],
      snag_ids: ['s'],
      photo_ids: [],
      comment_ids: [],
      activity_ids: [],
    } as unknown as Snapshot);
    expect(s.mirrors.p!.snags).toHaveLength(1);
    expect(s.mirrors.p!.snags[0]!.title).toBe('Changed');
    expect(localSnags(s, 'p')).toEqual([]);
    expect(s.mirrors.p!.synced_at).toBe('new');
  });
  it('overlays only queued changed fields and never invents a server number for a pending create', () => {
    const s = state();
    const base = {
      projectId: 'p',
      expectedUpdatedAt: null,
      state: 'queued' as const,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: 1000,
    };
    s.queue = [
      { ...base, id: 'op', snagId: 's', kind: 'edit', payload: { description: 'Offline' } },
      {
        ...base,
        id: 'create',
        snagId: 'new',
        kind: 'create',
        payload: { title: 'Pending', priority: 'medium' },
      },
    ] satisfies OfflineOperation[];
    const rows = localSnags(s, 'p', 'user');
    expect(rows.find((r) => r.id === 's')).toMatchObject({
      title: 'Remote',
      description: 'Offline',
    });
    expect(rows.find((r) => r.id === 'new')).toMatchObject({
      number: 0,
      client_id: 'new',
      created_by: 'user',
      priority: 'medium',
    });
  });
});
