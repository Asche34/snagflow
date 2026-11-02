import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../src/lib/supabase', () => ({
  get supabase() {
    return state.client;
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }));
import { saveSnag } from '../src/lib/mutations';
import { uploadPhotos } from '../src/lib/photos';
describe('connection-bound mutation intent', () => {
  it('does not start an old screen photo batch on a newly selected backend', async () => {
    let bReads = 0;
    const a = {};
    state.client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
          error: null,
        }),
      },
      from: () => {
        bReads++;
        throw Error('Reached deployment B');
      },
    };
    await expect(
      uploadPhotos(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            thumbnailId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            kind: 'issue',
            originalUri: 'private-photo',
            thumbnailUri: 'private-thumb',
            width: 100,
            height: 100,
            takenAt: '2026-11-02T00:00:00Z',
            status: 'queued',
          },
        ],
        () => {},
        0,
        a as never,
      ),
    ).rejects.toThrow('connection changed');
    expect(bReads).toBe(0);
  });
  it('never continues a delayed A create against deployment B after switching', async () => {
    const row = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      project_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      created_by: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      title: 'A private draft',
      priority: 'medium',
      description: null,
      category_id: null,
      location_id: null,
      due_date: null,
      assignee_id: null,
    };
    let finishAuth!: (value: { data: { user: { id: string } }; error: null }) => void;
    let bReads = 0;
    const a = {
      auth: {
        getUser: () =>
          new Promise((resolve) => {
            finishAuth = resolve;
          }),
      },
    };
    const b = {
      from: () => {
        bReads++;
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
        };
      },
    };
    state.client = a;
    const pending = saveSnag({
      clientId: row.client_id,
      projectId: row.project_id,
      title: row.title,
      priority: 'medium',
    });
    state.client = b;
    finishAuth({ data: { user: { id: row.created_by } }, error: null });
    await expect(pending).rejects.toThrow('connection changed');
    expect(bReads).toBe(0);
  });
});
