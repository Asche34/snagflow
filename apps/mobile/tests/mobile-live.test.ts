import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared';
import { randomUUID } from 'node:crypto';
import {
  CREDS,
  PROJECT_A,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TEST_PASSWORD,
  UIDS,
  hasEnv,
  serviceClient,
} from '../../../supabase/tests/helpers';
const state = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null }));
vi.mock('../src/lib/supabase', () => ({
  get supabase() {
    if (!state.client) throw Error('Not signed in');
    return state.client;
  },
}));
import { projectContext, listSnags, snagDetail } from '../src/lib/data';
import { saveSnag, updateSnag, addComment, assignSnag, transitionSnag } from '../src/lib/mutations';

if (hasEnv && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(SUPABASE_URL!).hostname)) {
  throw new Error('Mobile integration fixture writes are restricted to local Supabase.');
}

describe.skipIf(!hasEnv)('mobile services against local Supabase', () => {
  const clientId = randomUUID();
  let snagId: string;
  async function login(email: string) {
    state.client = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await state.client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (result.error) throw result.error;
  }
  beforeAll(() => login(CREDS.manager));
  afterAll(async () => {
    if (snagId) {
      const admin = serviceClient();
      await admin.from('activity_log').delete().eq('snag_id', snagId);
      await admin.from('notifications').delete().eq('snag_id', snagId);
      await admin.from('comments').delete().eq('snag_id', snagId);
      await admin.from('snags').delete().eq('id', snagId);
    }
    await state.client?.auth.signOut();
  });
  it('loads project metadata and named team members under user RLS', async () => {
    const context = await projectContext(PROJECT_A, UIDS.manager);
    expect(context.role).toBe('manager');
    expect(context.members.some((m) => !!m.profiles?.full_name)).toBe(true);
    expect(context.locations.length).toBeGreaterThan(0);
  });
  it('creates a numbered snag and exact retry updates its retained changed draft', async () => {
    const first = await saveSnag({
      clientId,
      projectId: PROJECT_A,
      title: `Mobile live ${clientId}`,
      priority: 'high',
    });
    snagId = first.id;
    expect(first.number).toBeGreaterThan(0);
    const second = await saveSnag({
      clientId,
      projectId: PROJECT_A,
      title: `Mobile revised ${clientId}`,
      priority: 'critical',
    });
    expect(second.id).toBe(first.id);
    const current = await snagDetail(first.id, UIDS.manager);
    expect(current.snag.title).toContain('revised');
    expect(current.snag.priority).toBe('critical');
  });
  it('searches the real generated English full-text column and number', async () => {
    const rows = await listSnags(PROJECT_A, { search: 'revised', priority: 'critical' });
    expect(rows.rows.some((r) => r.id === snagId)).toBe(true);
    const detail = await snagDetail(snagId, UIDS.manager);
    expect((await listSnags(PROJECT_A, { search: `#${detail.snag.number}` })).rows[0]?.id).toBe(
      snagId,
    );
  });
  it('reconciles exact comments and returns a recoverable prior receipt for changed drafts', async () => {
    const id = randomUUID();
    await addComment(id, snagId, 'Mobile site note');
    await addComment(id, snagId, 'Mobile site note');
    expect(await addComment(id, snagId, 'Changed')).toEqual({
      saved: false,
      previousBody: 'Mobile site note',
    });
    expect(
      (await snagDetail(snagId, UIDS.manager)).comments.filter((c) => c.id === id),
    ).toHaveLength(1);
  });
  it('reconciles an intentional unassignment on a revised create retry', async () => {
    await assignSnag(snagId, UIDS.member1);
    await saveSnag({
      clientId,
      projectId: PROJECT_A,
      title: `Mobile revised ${clientId}`,
      priority: 'critical',
      assigneeId: null,
    });
    expect((await snagDetail(snagId, UIDS.manager)).snag.assignee_id).toBeNull();
  });
  it('assigns, unassigns, starts work and enforces review fix evidence', async () => {
    await assignSnag(snagId, UIDS.member1);
    await assignSnag(snagId, null);
    expect((await snagDetail(snagId, UIDS.manager)).snag.assignee_id).toBeNull();
    await assignSnag(snagId, UIDS.member1);
    await login(CREDS.member1);
    await transitionSnag(snagId, 'in_progress', '');
    await expect(transitionSnag(snagId, 'ready_for_review', '')).rejects.toBeTruthy();
    expect((await snagDetail(snagId, UIDS.member1)).snag.status).toBe('in_progress');
  });
  it('limits assigned work to the active project IDs supplied by home', async () => {
    expect((await listSnags(null, { mine: UIDS.member1, projectIds: [] })).rows).toEqual([]);
    expect(
      (await listSnags(null, { mine: UIDS.member1, projectIds: [PROJECT_A] })).rows.some(
        (r) => r.id === snagId,
      ),
    ).toBe(true);
  });
  it('viewer can read but cannot edit, comment or approve through mobile service', async () => {
    await login(CREDS.viewer);
    expect((await snagDetail(snagId, UIDS.viewer)).snag.id).toBe(snagId);
    await expect(updateSnag(snagId, { title: 'Forbidden' })).rejects.toBeTruthy();
    await expect(addComment(randomUUID(), snagId, 'Forbidden')).rejects.toBeTruthy();
    await expect(transitionSnag(snagId, 'closed', '')).rejects.toBeTruthy();
  });
});
