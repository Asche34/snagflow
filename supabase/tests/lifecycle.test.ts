import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { CREDS, UIDS, hasEnv, signedInClient, serviceClient, type SupabaseClient } from './helpers.js';

describe.skipIf(!hasEnv)('Project archive and snag deletion authorization', () => {
  const project = crypto.randomUUID();
  const snag = crypto.randomUUID();
  let admin: SupabaseClient;
  let manager: SupabaseClient;
  let member: SupabaseClient;
  let viewer: SupabaseClient;
  let outsider: SupabaseClient;
  beforeAll(async () => {
    [admin, manager, member, viewer, outsider] = await Promise.all([
      signedInClient(CREDS.admin), signedInClient(CREDS.manager), signedInClient(CREDS.member1),
      signedInClient(CREDS.viewer), signedInClient(CREDS.member2),
    ]);
    const db = serviceClient();
    for (const result of [
      await db.from('projects').insert({ id: project, name: 'Lifecycle fixture', code: project, created_by: UIDS.admin }),
      await db.from('project_members').insert([
        { project_id: project, user_id: UIDS.manager, role: 'manager' },
        { project_id: project, user_id: UIDS.member1, role: 'member' },
        { project_id: project, user_id: UIDS.viewer, role: 'viewer' },
      ]),
      await db.from('snags').insert({ id: snag, client_id: snag, project_id: project, title: 'Retain history', created_by: UIDS.member1 }),
      await db.from('comments').insert({ snag_id: snag, author_id: UIDS.member1, body: 'Keep this comment' }),
    ]) if (result.error) throw result.error;
  });
  afterAll(async () => {
    const result = await serviceClient().from('projects').delete().eq('id', project);
    if (result.error) throw result.error;
  });
  it('member, viewer and unrelated member cannot archive or delete', async () => {
    for (const client of [member, viewer, outsider]) {
      const result = await client.from('projects').update({ status: 'archived' }).eq('id', project).select('id');
      expect(result.data ?? []).toHaveLength(0);
      expect((await client.rpc('soft_delete_snag', { p_snag_id: snag })).error).not.toBeNull();
    }
    const row = await serviceClient().from('snags').select('deleted_at').eq('id', snag).single();
    expect(row.data?.deleted_at).toBeNull();
  });
  it('manager archives and admin restores without removing records or access', async () => {
    const result = await manager.from('projects').update({ status: 'archived' }).eq('id', project).select('status').single();
    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('archived');
    expect((await viewer.from('snags').select('id').eq('id', snag).single()).data?.id).toBe(snag);
    const restored = await admin.from('projects').update({ status: 'active' }).eq('id', project).select('status').single();
    expect(restored.error).toBeNull();
    expect(restored.data?.status).toBe('active');
  });
  it('revoked manager cannot archive or delete', async () => {
    const db = serviceClient();
    await db.from('project_members').update({ role: 'viewer' }).eq('project_id', project).eq('user_id', UIDS.manager);
    try {
      expect((await manager.from('projects').update({ status: 'archived' }).eq('id', project).select('id')).data ?? []).toHaveLength(0);
      expect((await manager.rpc('soft_delete_snag', { p_snag_id: snag })).error).not.toBeNull();
    } finally {
      await db.from('project_members').update({ role: 'manager' }).eq('project_id', project).eq('user_id', UIDS.manager);
    }
  });
  it('manager deletion hides detail and comments via RLS, retains rows and audits once', async () => {
    const result = await manager.rpc('soft_delete_snag', { p_snag_id: snag });
    expect(result.error).toBeNull();
    for (const client of [manager, admin, member, viewer]) {
      expect((await client.from('snags').select('id').eq('id', snag)).data).toEqual([]);
      expect((await client.from('comments').select('id').eq('snag_id', snag)).data).toEqual([]);
    }
    const db = serviceClient();
    expect((await db.from('snags').select('deleted_at').eq('id', snag).single()).data?.deleted_at).toBeTruthy();
    expect((await db.from('comments').select('id').eq('snag_id', snag)).data).toHaveLength(1);
    expect((await manager.rpc('soft_delete_snag', { p_snag_id: snag })).error).not.toBeNull();
    const events = await db.from('activity_log').select('actor_id,action').eq('snag_id', snag).eq('action', 'deleted');
    expect(events.data).toEqual([{ actor_id: UIDS.manager, action: 'deleted' }]);
  });
});
