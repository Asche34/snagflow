import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREDS, UIDS, hasEnv, serviceClient, signedInClient, type SupabaseClient } from './helpers.js';

describe.skipIf(!hasEnv)('Phase 4 private artifacts', () => {
  const project = crypto.randomUUID();
  const snag = crypto.randomUUID();
  const photo = crypto.randomUUID();
  const paths: { bucket: string; path: string }[] = [];
  let manager: SupabaseClient;
  let member: SupabaseClient;
  let viewer: SupabaseClient;
  let outsider: SupabaseClient;
  const db = serviceClient();
  const document = { version: 1, width: 100, height: 100, objects: [] };
  async function upload(bucket: string, path: string, mime: string) {
    const result = await db.storage.from(bucket).upload(path, Buffer.from('phase4 artifact'), { contentType: mime });
    if (result.error) throw result.error;
    paths.push({ bucket, path });
  }
  beforeAll(async () => {
    [manager, member, viewer, outsider] = await Promise.all([
      signedInClient(CREDS.manager), signedInClient(CREDS.member1),
      signedInClient(CREDS.viewer), signedInClient(CREDS.member2),
    ]);
    for (const result of [
      await db.from('projects').insert({ id: project, name: 'Artifact security tests', code: project, created_by: UIDS.admin }),
      await db.from('project_members').insert([
        { project_id: project, user_id: UIDS.manager, role: 'manager' },
        { project_id: project, user_id: UIDS.member1, role: 'member' },
        { project_id: project, user_id: UIDS.viewer, role: 'viewer' },
      ]),
      await member.from('snags').insert({ id: snag, client_id: snag, project_id: project, title: 'Photo annotation', created_by: UIDS.member1 }),
      await member.from('snag_photos').insert({ id: photo, snag_id: snag, storage_path: `${project}/${snag}/original.jpg`, width: 100, height: 100, uploaded_by: UIDS.member1 }),
    ]) if (result.error) throw result.error;
  });
  afterAll(async () => {
    for (const { bucket, path } of paths) await db.storage.from(bucket).remove([path]);
    await db.from('report_generation_requests').delete().eq('project_id', project);
    await db.from('projects').delete().eq('id', project);
  });
  it('saves annotation separately, detects conflicts and reconciles the same retry', async () => {
    const original = await member.from('snag_photos').select('*').eq('id', photo).single();
    const path = `${project}/${snag}/${crypto.randomUUID()}.jpg`;
    await upload('snag-photos', path, 'image/jpeg');
    const args = { p_photo_id: photo, p_expected_updated_at: original.data!.updated_at, p_annotated_path: path, p_annotation_json: document };
    const saved = await member.rpc('save_photo_annotation', args);
    expect(saved.error).toBeNull();
    expect(saved.data.storage_path).toBe(original.data!.storage_path);
    expect(saved.data.annotated_path).toBe(path);
    expect((await member.rpc('save_photo_annotation', args)).error).toBeNull();
    const changed = await manager.rpc('save_photo_annotation', { ...args, p_annotation_json: { ...document, width: 101 } });
    expect(changed.error?.message).toContain('ANNOTATION_CONFLICT');
    expect((await member.from('snag_photos').update({ storage_path: path }).eq('id', photo)).error).not.toBeNull();
  });
  it('denies unauthorized annotation and cross-snag or absent image paths', async () => {
    const row = await db.from('snag_photos').select('updated_at').eq('id', photo).single();
    const args = { p_photo_id: photo, p_expected_updated_at: row.data!.updated_at, p_annotated_path: `${project}/${snag}/${crypto.randomUUID()}.jpg`, p_annotation_json: document };
    for (const client of [viewer, outsider]) expect((await client.rpc('save_photo_annotation', args)).error?.message).toContain('ANNOTATION_FORBIDDEN');
    expect((await member.rpc('save_photo_annotation', args)).error?.message).toContain('ANNOTATION_IMAGE');
    const otherPath = `${project}/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`;
    await upload('snag-photos', otherPath, 'image/jpeg');
    expect((await member.rpc('save_photo_annotation', { ...args, p_annotated_path: otherPath })).error?.message).toContain('ANNOTATION_PATH');
  });
  it('atomically allocates revisions, idempotently retries, and restricts private artifacts', async () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    for (const id of ids) await upload('reports', `${project}/${id}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const args = (id: string) => ({ p_id: id, p_project_id: project, p_format: 'xlsx', p_theme: 'classic', p_filters: {}, p_options: {}, p_storage_path: `${project}/${id}.xlsx` });
    const saved = await Promise.all(ids.map((id) => manager.rpc('save_report', args(id))));
    for (const result of saved) expect(result.error).toBeNull();
    expect(saved.map((result) => result.data.revision).sort()).toEqual([1, 2]);
    const retry = await manager.rpc('save_report', args(ids[0]!));
    expect(retry.error).toBeNull();
    expect(retry.data.revision).toBe(saved[0]!.data.revision);
    expect((await manager.rpc('save_report', { ...args(ids[0]!), p_theme: 'compact' })).error?.message).toContain('REPORT_IDENTITY');
    for (const client of [member, viewer, outsider]) {
      expect((await client.rpc('save_report', args(crypto.randomUUID()))).error?.message).toContain('REPORT_FORBIDDEN');
      expect((await client.from('reports').select('*').eq('project_id', project)).data).toEqual([]);
      expect((await client.storage.from('reports').download(`${project}/${ids[0]}.xlsx`)).error).not.toBeNull();
    }
    expect((await manager.storage.from('reports').download(`${project}/${ids[0]}.xlsx`)).error).toBeNull();
  });
  it('keeps source, flattened and report bytes immutable through Storage', async () => {
    const row = await db.from('snag_photos').select('storage_path,annotated_path').eq('id', photo).single();
    await upload('snag-photos', row.data!.storage_path, 'image/jpeg');
    for (const path of [row.data!.storage_path, row.data!.annotated_path!]) {
      expect((await manager.storage.from('snag-photos').update(path, Buffer.from('replacement'), { contentType: 'image/jpeg' })).error).not.toBeNull();
      await manager.storage.from('snag-photos').remove([path]);
      expect((await manager.storage.from('snag-photos').download(path)).error).toBeNull();
    }
    const orphan = `${project}/${crypto.randomUUID()}.pdf`;
    await upload('reports', orphan, 'application/pdf');
    await manager.storage.from('reports').remove([orphan]);
    expect((await manager.storage.from('reports').download(orphan)).error).toBeNull();
  });
  it('rate limits persistently and rejects nonmanagers before consuming quota', async () => {
    for (const client of [member, viewer, outsider]) expect((await client.rpc('claim_report_generation', { p_project_id: project })).error?.message).toContain('REPORT_FORBIDDEN');
    for (let i = 0; i < 5; i++) expect((await manager.rpc('claim_report_generation', { p_project_id: project })).error).toBeNull();
    expect((await manager.rpc('claim_report_generation', { p_project_id: project })).error?.message).toContain('REPORT_RATE_LIMIT');
  });
  it('revoked and inactive actors cannot save existing artifacts', async () => {
    await db.from('project_members').delete().eq('project_id', project).eq('user_id', UIDS.member1);
    const row = await db.from('snag_photos').select('updated_at,annotated_path').eq('id', photo).single();
    expect((await member.rpc('save_photo_annotation', { p_photo_id: photo, p_expected_updated_at: row.data!.updated_at, p_annotated_path: row.data!.annotated_path, p_annotation_json: document })).error?.message).toContain('ANNOTATION_FORBIDDEN');
    // A disposable profile avoids changing any seeded actor used by other suites.
    const user = await db.auth.admin.createUser({ email: `phase4-${crypto.randomUUID()}@snagflow.test`, password: 'Password123!', email_confirm: true });
    if (user.error) throw user.error;
    const id = user.data.user.id;
    try {
      await db.from('project_members').insert({ project_id: project, user_id: id, role: 'manager' });
      const inactive = await signedInClient(user.data.user.email!);
      await db.from('profiles').update({ is_active: false }).eq('id', id);
      expect((await inactive.rpc('claim_report_generation', { p_project_id: project })).error?.message).toContain('REPORT_FORBIDDEN');
      expect((await inactive.from('reports').select('id').eq('project_id', project)).data).toEqual([]);
    } finally { await db.auth.admin.deleteUser(id); }
  });
});
