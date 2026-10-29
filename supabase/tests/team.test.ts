import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CREDS,
  UIDS,
  hasEnv,
  signedInClient,
  serviceClient,
  type SupabaseClient,
} from './helpers.js';

describe.skipIf(!hasEnv)('Team and invite lifecycle', () => {
  const project = crypto.randomUUID();
  const unrelated = crypto.randomUUID();
  let originalName: string | undefined;
  let admin: SupabaseClient,
    manager: SupabaseClient,
    member: SupabaseClient,
    viewer: SupabaseClient;
  beforeAll(async () => {
    [admin, manager, member, viewer] = await Promise.all([
      signedInClient(CREDS.admin),
      signedInClient(CREDS.manager),
      signedInClient(CREDS.member1),
      signedInClient(CREDS.viewer),
    ]);
    const profile = await serviceClient()
      .from('profiles')
      .select('full_name')
      .eq('id', UIDS.member1)
      .single();
    if (profile.error) throw profile.error;
    originalName = profile.data.full_name;
    const setup = await serviceClient()
      .from('projects')
      .insert(
        [project, unrelated].map((id) => ({
          id,
          name: 'Team RPC fixture',
          code: id,
          created_by: UIDS.admin,
        })),
      );
    if (setup.error) throw setup.error;
    const roles = await serviceClient()
      .from('project_members')
      .insert([
        { project_id: project, user_id: UIDS.manager, role: 'manager' },
        { project_id: project, user_id: UIDS.viewer, role: 'viewer' },
      ]);
    if (roles.error) throw roles.error;
  });
  afterAll(async () => {
    if (originalName !== undefined) {
      const restored = await serviceClient()
        .from('profiles')
        .update({ full_name: originalName })
        .eq('id', UIDS.member1);
      if (restored.error) throw restored.error;
    }
    const cleanup = await serviceClient().from('projects').delete().in('id', [project, unrelated]);
    if (cleanup.error) throw cleanup.error;
  });
  it('manager adds an existing confirmed account by canonical email without duplicate overwrite', async () => {
    const result = await manager.rpc('add_project_member', {
      p_project_id: project,
      p_email: CREDS.member2.toUpperCase(),
      p_role: 'member',
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe(UIDS.member2);
    const duplicate = await manager.rpc('add_project_member', {
      p_project_id: project,
      p_email: CREDS.member2,
      p_role: 'manager',
    });
    expect(duplicate.error?.message).toContain('MEMBER_EXISTS');
    const row = await serviceClient()
      .from('project_members')
      .select('role')
      .eq('project_id', project)
      .eq('user_id', UIDS.member2)
      .single();
    expect(row.data?.role).toBe('member');
  });
  it('manager changes roles and removes members within the authorized project', async () => {
    const changed = await manager.rpc('set_project_member', {
      p_project_id: project,
      p_user_id: UIDS.member2,
      p_role: 'viewer',
    });
    expect(changed.error).toBeNull();
    const row = await serviceClient()
      .from('project_members')
      .select('role')
      .eq('project_id', project)
      .eq('user_id', UIDS.member2)
      .single();
    expect(row.data?.role).toBe('viewer');
    const removed = await manager.rpc('set_project_member', {
      p_project_id: project,
      p_user_id: UIDS.member2,
      p_role: null,
    });
    expect(removed.error).toBeNull();
    const missing = await serviceClient()
      .from('project_members')
      .select('user_id')
      .eq('project_id', project)
      .eq('user_id', UIDS.member2);
    expect(missing.data).toEqual([]);
  });
  it('members/viewers/unrelated managers cannot mutate or probe account email', async () => {
    for (const [client, id] of [
      [member, project],
      [viewer, project],
      [manager, unrelated],
    ] as const) {
      const result = await client.rpc('add_project_member', {
        p_project_id: id,
        p_email: CREDS.member2,
        p_role: 'manager',
      });
      expect(result.error?.message).toContain('TEAM_PERMISSION');
      const update = await client.rpc('set_project_member', {
        p_project_id: id,
        p_user_id: UIDS.manager,
        p_role: 'viewer',
      });
      expect(update.error?.message).toContain('TEAM_PERMISSION');
    }
  });
  it('only admins prepare immutable pending invites, and project managers may cancel them', async () => {
    const input = {
      p_id: crypto.randomUUID(),
      p_project_id: project,
      p_email: `team-${crypto.randomUUID()}@snagflow.test`,
      p_role: 'member',
    };
    const denied = await manager.rpc('prepare_project_invite', input);
    expect(denied.error?.message).toContain('INVITE_PERMISSION');
    const prepared = await admin.rpc('prepare_project_invite', input);
    expect(prepared.error).toBeNull();
    const repeated = await admin.rpc('prepare_project_invite', input);
    expect(repeated.data).toEqual(prepared.data);
    const changed = await admin.rpc('prepare_project_invite', { ...input, p_role: 'manager' });
    expect(changed.error?.message).toContain('INVITE_DETAILS');
    const duplicate = await admin.rpc('prepare_project_invite', {
      ...input,
      p_id: crypto.randomUUID(),
    });
    expect(duplicate.error?.message).toContain('INVITE_PENDING');
    const canceled = await manager.rpc('cancel_project_invite', { p_id: input.p_id });
    expect(canceled.error).toBeNull();
  });
  async function invitation(overrides: Record<string, unknown> = {}) {
    const id = crypto.randomUUID(),
      token = crypto.randomUUID();
    const result = await serviceClient()
      .from('invites')
      .insert({
        id,
        token,
        email: CREDS.member1,
        project_id: project,
        role: 'member',
        invited_by: UIDS.admin,
        ...overrides,
      });
    if (result.error) throw result.error;
    return { id, token };
  }
  it('confirmed matching recipient accepts once; replay never changes a role or restores removed membership', async () => {
    const invite = await invitation();
    const wrong = await viewer.rpc('get_my_project_invite', { p_token: invite.token });
    expect(wrong.data).toEqual([]);
    const wrongAccept = await viewer.rpc('accept_project_invite', {
      p_token: invite.token,
      p_full_name: 'Wrong user',
    });
    expect(wrongAccept.error?.message).toContain('INVITE_INVALID');
    const accepted = await member.rpc('accept_project_invite', {
      p_token: invite.token,
      p_full_name: 'Alex Member',
    });
    expect(accepted.error).toBeNull();
    expect(accepted.data).toBe(project);
    await manager.rpc('set_project_member', {
      p_project_id: project,
      p_user_id: UIDS.member1,
      p_role: 'viewer',
    });
    const replay = await member.rpc('accept_project_invite', {
      p_token: invite.token,
      p_full_name: 'Replay',
    });
    expect(replay.error).toBeNull();
    const row = await serviceClient()
      .from('project_members')
      .select('role')
      .eq('project_id', project)
      .eq('user_id', UIDS.member1)
      .single();
    expect(row.data?.role).toBe('viewer');
    await manager.rpc('set_project_member', {
      p_project_id: project,
      p_user_id: UIDS.member1,
      p_role: null,
    });
    const revokedReplay = await member.rpc('accept_project_invite', {
      p_token: invite.token,
      p_full_name: 'Replay',
    });
    expect(revokedReplay.error?.message).toContain('INVITE_INVALID');
  });
  it('expired/canceled/no-longer-authorized invitations cannot grant membership', async () => {
    for (const overrides of [
      { expires_at: '2000-01-01T00:00:00Z' },
      { invited_by: UIDS.manager },
      {},
    ]) {
      const invite = await invitation(overrides);
      if (Object.keys(overrides).length === 0)
        await manager.rpc('cancel_project_invite', { p_id: invite.id });
      const result = await member.rpc('accept_project_invite', {
        p_token: invite.token,
        p_full_name: 'Member',
      });
      expect(result.error?.message).toContain('INVITE_INVALID');
      await serviceClient().from('invites').delete().eq('id', invite.id);
    }
  });
});
