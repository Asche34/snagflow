import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  CREDS,
  UIDS,
  hasEnv,
  signedInClient,
  serviceClient,
  type SupabaseClient,
} from './helpers.js';

describe.skipIf(!hasEnv)('Project details RLS', () => {
  const project = crypto.randomUUID();
  let admin: SupabaseClient;
  let manager: SupabaseClient;
  let member: SupabaseClient;
  let viewer: SupabaseClient;
  beforeAll(async () => {
    [admin, manager, member, viewer] = await Promise.all([
      signedInClient(CREDS.admin),
      signedInClient(CREDS.manager),
      signedInClient(CREDS.member1),
      signedInClient(CREDS.viewer),
    ]);
    const result = await serviceClient()
      .from('projects')
      .insert({
        id: project,
        name: 'Project RLS fixture',
        code: `DB${Date.now()}`,
        created_by: UIDS.admin,
      });
    if (result.error) throw result.error;
    const membership = await serviceClient()
      .from('project_members')
      .insert([
        { project_id: project, user_id: UIDS.manager, role: 'manager' },
        { project_id: project, user_id: UIDS.member1, role: 'member' },
        { project_id: project, user_id: UIDS.viewer, role: 'viewer' },
      ]);
    if (membership.error) throw membership.error;
  });
  afterAll(async () => {
    const result = await serviceClient().from('projects').delete().eq('id', project);
    if (result.error) throw result.error;
  });
  it('only an admin creates projects using the caller session', async () => {
    for (const client of [manager, member, viewer]) {
      const result = await client
        .from('projects')
        .insert({ name: 'Denied project', code: crypto.randomUUID(), created_by: UIDS.admin });
      expect(result.error).not.toBeNull();
    }
    const id = crypto.randomUUID();
    const result = await admin
      .from('projects')
      .insert({ id, name: 'Admin-created project', code: id, created_by: UIDS.admin })
      .select('id')
      .single();
    try {
      expect(result.error).toBeNull();
      expect(result.data?.id).toBe(id);
    } finally {
      await serviceClient().from('projects').delete().eq('id', id);
    }
  });
  it('manager updates details while members/viewers cannot', async () => {
    const result = await manager
      .from('projects')
      .update({ name: 'Manager edit', require_fix_photo: false })
      .eq('id', project)
      .select('name,require_fix_photo')
      .single();
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ name: 'Manager edit', require_fix_photo: false });
    for (const client of [member, viewer]) {
      const denied = await client
        .from('projects')
        .update({ name: 'Unauthorized edit' })
        .eq('id', project)
        .select('id');
      expect(denied.data ?? []).toHaveLength(0);
    }
    const row = await serviceClient().from('projects').select('name').eq('id', project).single();
    expect(row.data?.name).toBe('Manager edit');
  });
  it('a manager of another project cannot edit an unrelated project', async () => {
    const id = crypto.randomUUID();
    const setup = await serviceClient()
      .from('projects')
      .insert({ id, name: 'Unrelated', code: id, created_by: UIDS.admin });
    if (setup.error) throw setup.error;
    try {
      const result = await manager
        .from('projects')
        .update({ name: 'Not allowed' })
        .eq('id', id)
        .select('id');
      expect(result.data ?? []).toHaveLength(0);
      const row = await serviceClient().from('projects').select('name').eq('id', id).single();
      expect(row.data?.name).toBe('Unrelated');
    } finally {
      await serviceClient().from('projects').delete().eq('id', id);
    }
  });
});
