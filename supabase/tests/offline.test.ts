import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CREDS,
  PROJECT_A,
  PROJECT_B,
  UIDS,
  hasEnv,
  serviceClient,
  signedInClient,
  type SupabaseClient,
} from './helpers.js';

describe.skipIf(!hasEnv)('durable offline mutations', () => {
  let manager: SupabaseClient;
  let member: SupabaseClient;
  let viewer: SupabaseClient;
  let outsider: SupabaseClient;
  let svc: SupabaseClient;
  const created: string[] = [];
  const operations: string[] = [];
  const projects: string[] = [];
  beforeAll(async () => {
    [manager, member, viewer, outsider] = await Promise.all([
      signedInClient(CREDS.manager),
      signedInClient(CREDS.member1),
      signedInClient(CREDS.viewer),
      signedInClient(CREDS.member2),
    ]);
    svc = serviceClient();
  });
  afterAll(async () => {
    if (created.length) await svc.from('snags').delete().in('id', created);
    if (operations.length)
      await svc.from('offline_mutation_receipts').delete().in('id', operations);
    if (projects.length) await svc.from('projects').delete().in('id', projects);
  });
  const write = (
    client: SupabaseClient,
    snag: string,
    kind: string,
    payload: Record<string, unknown>,
    expected: string | null = null,
    operation = crypto.randomUUID(),
    project = PROJECT_A,
  ) => {
    operations.push(operation);
    return client.rpc('apply_offline_mutation', {
      p_id: operation,
      p_project_id: project,
      p_snag_id: snag,
      p_kind: kind,
      p_payload: payload,
      p_expected_updated_at: expected,
    });
  };
  const create = async () => {
    const id = crypto.randomUUID();
    created.push(id);
    const result = await write(member, id, 'create', {
      title: 'Offline fixture',
      priority: 'medium',
    });
    expect(result.error).toBeNull();
    return result.data.snag as { id: string; updated_at: string; number: number };
  };

  it('replays a committed create with the same number and rejects changed identity payloads', async () => {
    const id = crypto.randomUUID();
    created.push(id);
    const operation = crypto.randomUUID();
    const first = await write(member, id, 'create', { title: 'Replay fixture' }, null, operation);
    expect(first.error).toBeNull();
    const replay = await write(member, id, 'create', { title: 'Replay fixture' }, null, operation);
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);
    expect(replay.data.snag.client_id).toBe(id);
    expect(
      (await svc.from('snags').select('id', { count: 'exact' }).eq('client_id', id)).count,
    ).toBe(1);
    const collision = await write(
      member,
      id,
      'create',
      { title: 'Different intent' },
      null,
      operation,
    );
    expect(collision.error?.message).toContain('OFFLINE_IDENTITY');
  });

  it('rejects viewers, other-project members, and protected payload fields', async () => {
    const id = crypto.randomUUID();
    expect((await write(viewer, id, 'create', { title: 'Forbidden' })).error?.message).toContain(
      'OFFLINE_FORBIDDEN',
    );
    expect(
      (
        await write(
          outsider,
          id,
          'create',
          { title: 'Forbidden' },
          null,
          crypto.randomUUID(),
          PROJECT_B,
        )
      ).error?.message,
    ).toContain('OFFLINE_FORBIDDEN');
    expect(
      (await write(member, id, 'create', { title: 'Forbidden', status: 'closed' })).error?.message,
    ).toContain('OFFLINE_PAYLOAD');
  });

  it('replays comments without a second comment or notification', async () => {
    const snag = await create();
    const operation = crypto.randomUUID();
    const first = await write(
      manager,
      snag.id,
      'comment',
      { body: 'Retained across restart' },
      null,
      operation,
    );
    expect(first.error).toBeNull();
    const before = await svc
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('snag_id', snag.id)
      .eq('type', 'comment');
    expect(before.count).toBe(1);
    expect(
      (
        await write(
          manager,
          snag.id,
          'comment',
          { body: 'Retained across restart' },
          null,
          operation,
        )
      ).data,
    ).toEqual(first.data);
    expect(
      (await svc.from('comments').select('id', { count: 'exact' }).eq('id', operation)).count,
    ).toBe(1);
    expect(
      (
        await svc
          .from('notifications')
          .select('id', { count: 'exact' })
          .eq('snag_id', snag.id)
          .eq('type', 'comment')
      ).count,
    ).toBe(before.count);
  });

  it('serializes concurrent replays without duplicate assignment activity', async () => {
    const snag = await create();
    const operation = crypto.randomUUID();
    const requests = await Promise.all(
      Array.from({ length: 6 }, () =>
        write(
          manager,
          snag.id,
          'assign',
          { assignee_id: UIDS.member1 },
          snag.updated_at,
          operation,
        ),
      ),
    );
    for (const request of requests) {
      expect(request.error).toBeNull();
      expect(request.data).toEqual(requests[0]?.data);
    }
    expect(
      (
        await svc
          .from('activity_log')
          .select('id', { count: 'exact' })
          .eq('snag_id', snag.id)
          .eq('action', 'assigned')
      ).count,
    ).toBe(1);
  });

  it('requires a server version for edits and rejects cross-project metadata', async () => {
    const snag = await create();
    expect(
      (await write(member, snag.id, 'edit', { title: 'No version' })).error?.message,
    ).toContain('OFFLINE_CONFLICT');
    const category = await svc
      .from('categories')
      .select('id')
      .eq('project_id', PROJECT_B)
      .limit(1)
      .single();
    expect(category.error).toBeNull();
    expect(
      (await write(member, snag.id, 'edit', { category_id: category.data?.id }, snag.updated_at))
        .error?.message,
    ).toContain('OFFLINE_PAYLOAD');
  });

  it('replays workflow receipts once and retains deliberate conflicts', async () => {
    const snag = await create();
    const assigned = await write(
      manager,
      snag.id,
      'assign',
      { assignee_id: UIDS.member1 },
      snag.updated_at,
    );
    expect(assigned.error).toBeNull();
    const operation = crypto.randomUUID();
    const started = await write(
      member,
      snag.id,
      'transition',
      { to_status: 'in_progress' },
      assigned.data.snag.updated_at,
      operation,
    );
    expect(started.error).toBeNull();
    const replay = await write(
      member,
      snag.id,
      'transition',
      { to_status: 'in_progress' },
      assigned.data.snag.updated_at,
      operation,
    );
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(started.data);
    const activities = await svc
      .from('activity_log')
      .select('id', { count: 'exact' })
      .eq('snag_id', snag.id)
      .eq('action', 'status_changed');
    expect(activities.count).toBe(1);
    const conflict = await write(
      manager,
      snag.id,
      'assign',
      { assignee_id: UIDS.member2 },
      snag.updated_at,
    );
    expect(conflict.error?.message).toContain('OFFLINE_CONFLICT');
  });

  it('merges changed plain fields while preserving server-newer fields', async () => {
    const snag = await create();
    expect(
      (
        await manager
          .from('snags')
          .update({ title: 'Manager wins', description: 'Keep remote description' })
          .eq('id', snag.id)
      ).error,
    ).toBeNull();
    const result = await write(
      member,
      snag.id,
      'edit',
      { title: 'Old local title', priority: 'high' },
      snag.updated_at,
    );
    expect(result.error).toBeNull();
    expect(result.data.snag.title).toBe('Manager wins');
    expect(result.data.snag.description).toBe('Keep remote description');
    expect(result.data.snag.priority).toBe('high');
    expect(result.data.skipped_fields).toEqual(['title']);
  });

  it('does not permit a noncreator detail edit or a member assignment', async () => {
    const snag = await create();
    expect(
      (await write(outsider, snag.id, 'edit', { title: 'Wrong creator' }, snag.updated_at)).error
        ?.message,
    ).toContain('OFFLINE_FORBIDDEN');
    expect(
      (await write(member, snag.id, 'assign', { assignee_id: UIDS.member1 }, snag.updated_at)).error
        ?.message,
    ).toContain('SNAG_ASSIGN_FORBIDDEN');
  });

  it('rechecks access before returning a receipt and isolates operation ownership', async () => {
    const snag = await create();
    const operation = crypto.randomUUID();
    expect(
      (await write(member, snag.id, 'comment', { body: 'Owner receipt' }, null, operation)).error,
    ).toBeNull();
    expect(
      (await write(manager, snag.id, 'comment', { body: 'Owner receipt' }, null, operation)).error
        ?.message,
    ).toContain('OFFLINE_IDENTITY');
    const project = crypto.randomUUID();
    projects.push(project);
    expect(
      (
        await svc
          .from('projects')
          .insert({
            id: project,
            code: `OFF-${project.slice(0, 8)}`,
            name: 'Offline revocation fixture',
            created_by: UIDS.admin,
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await svc
          .from('project_members')
          .insert({ project_id: project, user_id: UIDS.member1, role: 'member' })
      ).error,
    ).toBeNull();
    const otherSnag = crypto.randomUUID();
    created.push(otherSnag);
    const createId = crypto.randomUUID();
    expect(
      (
        await write(
          member,
          otherSnag,
          'create',
          { title: 'Revocation fixture' },
          null,
          createId,
          project,
        )
      ).error,
    ).toBeNull();
    expect(
      (
        await svc
          .from('project_members')
          .delete()
          .eq('project_id', project)
          .eq('user_id', UIDS.member1)
      ).error,
    ).toBeNull();
    expect(
      (
        await write(
          member,
          otherSnag,
          'create',
          { title: 'Revocation fixture' },
          null,
          createId,
          project,
        )
      ).error?.message,
    ).toContain('OFFLINE_FORBIDDEN');
  });

  it('pulls complete project metadata, inclusive deltas and deletion tombstones', async () => {
    const snag = await create();
    const first = await member.rpc('mobile_sync_snapshot', { p_project_id: PROJECT_A });
    expect(first.error).toBeNull();
    expect(first.data.project.id).toBe(PROJECT_A);
    expect(
      first.data.members.some(
        (m: { user_id: string; profiles: { full_name: string } }) =>
          m.user_id === UIDS.member1 && !!m.profiles.full_name,
      ),
    ).toBe(true);
    expect(first.data.snags.some((s: { id: string }) => s.id === snag.id)).toBe(true);
    await manager.rpc('soft_delete_snag', { p_snag_id: snag.id });
    const delta = await member.rpc('mobile_sync_snapshot', {
      p_project_id: PROJECT_A,
      p_since: first.data.synced_at,
    });
    expect(delta.error).toBeNull();
    expect(delta.data.snags.find((s: { id: string }) => s.id === snag.id)?.deleted_at).toBeTruthy();
    expect(delta.data.snag_ids).toContain(snag.id);
    expect(delta.data.members.length).toBe(first.data.members.length);
    expect(
      (await outsider.rpc('mobile_sync_snapshot', { p_project_id: PROJECT_B })).error?.message,
    ).toContain('OFFLINE_FORBIDDEN');
  });
});
