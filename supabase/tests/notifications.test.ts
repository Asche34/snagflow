import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CREDS,
  UIDS,
  hasEnv,
  serviceClient,
  signedInClient,
  type SupabaseClient,
} from './helpers.js';

describe.skipIf(!hasEnv)('Personal collaboration notifications', () => {
  const project = crypto.randomUUID();
  const snag = crypto.randomUUID();
  let member: SupabaseClient;
  let manager: SupabaseClient;
  let viewer: SupabaseClient;
  beforeAll(async () => {
    member = await signedInClient(CREDS.member1);
    manager = await signedInClient(CREDS.manager);
    viewer = await signedInClient(CREDS.viewer);
    const db = serviceClient();
    for (const result of [
      await db
        .from('projects')
        .insert({ id: project, name: 'Notification tests', code: project, created_by: UIDS.admin }),
      await db.from('project_members').insert([
        { project_id: project, user_id: UIDS.manager, role: 'manager' },
        { project_id: project, user_id: UIDS.member1, role: 'member' },
        { project_id: project, user_id: UIDS.viewer, role: 'viewer' },
      ]),
      await member
        .from('snags')
        .insert({
          id: snag,
          client_id: snag,
          project_id: project,
          title: 'Notification defect',
          created_by: UIDS.member1,
        }),
      await manager.rpc('assign_snag', { p_snag_id: snag, p_assignee_id: UIDS.member1 }),
    ])
      if (result.error) throw result.error;
  });
  afterAll(async () => {
    const result = await serviceClient().from('projects').delete().eq('id', project);
    if (result.error) throw result.error;
  });
  it('notifies a distinct creator/assignee once and excludes the commenting actor', async () => {
    const id = crypto.randomUUID();
    expect(
      (
        await manager
          .from('comments')
          .insert({ id, snag_id: snag, author_id: UIDS.manager, body: id })
      ).error,
    ).toBeNull();
    const rows = await serviceClient()
      .from('notifications')
      .select('*')
      .eq('project_id', project)
      .eq('type', 'comment');
    expect(rows.error).toBeNull();
    expect(
      rows.data
        ?.filter((row) => (row.payload as { snippet?: string }).snippet === id)
        .map((row) => row.user_id),
    ).toEqual([UIDS.member1]);
    const self = crypto.randomUUID();
    expect(
      (await member.from('comments').insert({ snag_id: snag, author_id: UIDS.member1, body: self }))
        .error,
    ).toBeNull();
    expect(
      (
        await serviceClient()
          .from('notifications')
          .select('id')
          .eq('project_id', project)
          .contains('payload', { snippet: self })
      ).data,
    ).toHaveLength(0);
  });
  it('enforces private reads and read-state writes including recipient reassignment', async () => {
    const row = await serviceClient()
      .from('notifications')
      .select('id')
      .eq('project_id', project)
      .eq('user_id', UIDS.member1)
      .limit(1)
      .single();
    expect(row.error).toBeNull();
    const id = row.data!.id;
    expect((await viewer.from('notifications').select('id').eq('id', id)).data).toEqual([]);
    expect(
      (
        await viewer
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', id)
          .select('id')
      ).data,
    ).toEqual([]);
    expect(
      (await member.from('notifications').update({ user_id: UIDS.viewer }).eq('id', id)).error,
    ).not.toBeNull();
    const read = await member
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select('read_at')
      .single();
    expect(read.error).toBeNull();
    expect(read.data?.read_at).not.toBeNull();
  });
  it('does not notify a creator/assignee after project access is removed', async () => {
    expect(
      (
        await serviceClient()
          .from('project_members')
          .delete()
          .eq('project_id', project)
          .eq('user_id', UIDS.member1)
      ).error,
    ).toBeNull();
    const body = crypto.randomUUID();
    expect(
      (await manager.from('comments').insert({ snag_id: snag, author_id: UIDS.manager, body }))
        .error,
    ).toBeNull();
    expect(
      (
        await serviceClient()
          .from('notifications')
          .select('id')
          .eq('project_id', project)
          .contains('payload', { snippet: body })
      ).data,
    ).toHaveLength(0);
  });
});
