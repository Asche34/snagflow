import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  CREDS,
  UIDS,
  hasEnv,
  signedInClient,
  serviceClient,
  type SupabaseClient,
} from './helpers.js';

describe.skipIf(!hasEnv)('Project metadata historical integrity', () => {
  const project = crypto.randomUUID();
  const other = crypto.randomUUID();
  const root = crypto.randomUUID();
  const child = crypto.randomUUID();
  const category = crypto.randomUUID();
  const snag = crypto.randomUUID();
  let manager: SupabaseClient;
  beforeAll(async () => {
    manager = await signedInClient(CREDS.manager);
    const db = serviceClient();
    for (const result of [
      await db
        .from('projects')
        .insert(
          [project, other].map((id) => ({
            id,
            name: 'Metadata fixture',
            code: id,
            created_by: UIDS.admin,
          })),
        ),
      await db.from('project_members').insert([
        { project_id: project, user_id: UIDS.manager, role: 'manager' },
        { project_id: project, user_id: UIDS.member1, role: 'member' },
      ]),
      await db.from('locations').insert({ id: root, project_id: project, name: 'Building' }),
      await db
        .from('locations')
        .insert({ id: child, project_id: project, parent_id: root, name: 'Room' }),
      await db.from('categories').insert({ id: category, project_id: project, name: 'Electrical' }),
      await db
        .from('snags')
        .insert({
          id: snag,
          client_id: snag,
          project_id: project,
          title: 'Historic defect',
          created_by: UIDS.member1,
          location_id: child,
          category_id: category,
        }),
    ])
      if (result.error) throw result.error;
  });
  afterAll(async () => {
    const result = await serviceClient().from('projects').delete().in('id', [project, other]);
    if (result.error) throw result.error;
  });
  it('retains references on soft-deleted snags and refuses deleting nonempty branches', async () => {
    expect((await manager.rpc('soft_delete_snag', { p_snag_id: snag })).error).toBeNull();
    expect((await manager.from('locations').delete().eq('id', child)).error?.code).toBe('23503');
    expect((await manager.from('categories').delete().eq('id', category)).error?.code).toBe(
      '23503',
    );
    expect((await manager.from('locations').delete().eq('id', root)).error?.code).toBe('23503');
    expect(
      (
        await serviceClient()
          .from('snags')
          .select('location_id,category_id')
          .eq('id', snag)
          .single()
      ).data,
    ).toEqual({ location_id: child, category_id: category });
  });
  it('rejects hierarchy cycles, self-parenting, project moves and foreign parents', async () => {
    expect(
      (await manager.from('locations').update({ parent_id: child }).eq('id', root)).error,
    ).not.toBeNull();
    expect(
      (await manager.from('locations').update({ parent_id: child }).eq('id', child)).error,
    ).not.toBeNull();
    const foreign = crypto.randomUUID();
    expect(
      (
        await serviceClient()
          .from('locations')
          .insert({ id: foreign, project_id: other, name: 'Foreign' })
      ).error,
    ).toBeNull();
    expect(
      (await manager.from('locations').update({ parent_id: foreign }).eq('id', child)).error,
    ).not.toBeNull();
    expect(
      (await serviceClient().from('locations').update({ project_id: other }).eq('id', child)).error,
    ).not.toBeNull();
    expect(
      (await serviceClient().from('categories').update({ project_id: other }).eq('id', category))
        .error,
    ).not.toBeNull();
  });
  it('manager renames without changing identity, creates and removes unused leaves; member writes denied', async () => {
    expect(
      (
        await manager
          .from('locations')
          .update({ name: 'Renamed room', sort_order: 3 })
          .eq('id', child)
          .select('id,name')
          .single()
      ).data,
    ).toEqual({ id: child, name: 'Renamed room' });
    const leaf = crypto.randomUUID();
    expect(
      (await manager.from('locations').insert({ id: leaf, project_id: project, name: 'Unused' }))
        .error,
    ).toBeNull();
    expect((await manager.from('locations').delete().eq('id', leaf).select('id')).data).toEqual([
      { id: leaf },
    ]);
    const member = await signedInClient(CREDS.member1);
    expect(
      (await member.from('categories').insert({ project_id: project, name: 'Denied' })).error,
    ).not.toBeNull();
    expect(
      (await member.from('categories').update({ name: 'Denied' }).eq('id', category).select('id'))
        .data,
    ).toEqual([]);
    expect((await member.from('categories').delete().eq('id', category).select('id')).data).toEqual(
      [],
    );
  });
  it('concurrent opposite parent moves cannot commit a cycle', async () => {
    for (let iteration = 0; iteration < 5; iteration++) {
      const a = crypto.randomUUID();
      const b = crypto.randomUUID();
      expect(
        (
          await manager.from('locations').insert([
            { id: a, project_id: project, name: 'Concurrent A' },
            { id: b, project_id: project, name: 'Concurrent B' },
          ])
        ).error,
      ).toBeNull();
      const results = await Promise.all([
        manager.from('locations').update({ parent_id: b }).eq('id', a),
        manager.from('locations').update({ parent_id: a }).eq('id', b),
      ]);
      expect(results.filter((result) => result.error)).toHaveLength(1);
      const rows = await manager.from('locations').select('id,parent_id').in('id', [a, b]);
      expect(rows.error).toBeNull();
      expect(rows.data?.filter((row) => row.parent_id !== null)).toHaveLength(1);
    }
  });
});
