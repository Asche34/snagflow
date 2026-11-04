import { expect, test, type Page, type Route } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { createClient } = createRequire(new URL('../../supabase/package.json', import.meta.url))(
  '@supabase/supabase-js',
) as typeof import('../../supabase/node_modules/@supabase/supabase-js');
const settings: Record<string, string> = {};
const envPath = fileURLToPath(new URL('../../supabase/tests/test.env', import.meta.url));
for (const line of (existsSync(envPath) ? readFileSync(envPath, 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
  if (match) settings[match[1]!] = match[2]!;
}
const api = process.env['SUPABASE_URL'] ?? settings['SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? settings['SUPABASE_SERVICE_ROLE_KEY'];
const anon = process.env['SUPABASE_ANON_KEY'] ?? settings['SUPABASE_ANON_KEY'];
if (!api || !serviceKey || !anon) throw Error('Offline mobile E2E requires local Supabase test credentials.');
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(api).hostname))
  throw Error('Offline mobile E2E fixture writes are restricted to local Supabase.');
const backend = createClient(api, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let manager = createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const users = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  member: '33333333-3333-4333-8333-333333333333',
};
const projectId = crypto.randomUUID();
const projectName = `Offline acceptance ${Date.now()}`;
let managerName = '';

async function login(page: Page, role: 'manager' | 'member1' | 'viewer' = 'manager') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect.poll(async () => (await page.getByText(/Last synced/).textContent()) ?? '').not.toContain('never');
}

/** A backend partition lets the app process reload from the preview server without adding PWA shell caching. */
async function partition(page: Page) {
  const state = { rest: false, auth: false, storage: false };
  const handler = async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (state.rest && path.startsWith('/rest/v1/') || state.auth && path.startsWith('/auth/v1/') || state.storage && path.startsWith('/storage/v1/'))
      await route.abort('internetdisconnected');
    else await route.continue();
  };
  await page.route(`${api}/**`, handler);
  return state;
}

async function addPhoto(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 800;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#c2410c'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#203d2c'; context.fillRect(120, 80, 400, 500);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles({ name: 'offline-defect.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByText('Review photo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with photo', exact: true }).click();
}

async function status(id: string) {
  const result = await backend.from('snags').select('status').eq('id', id).single();
  if (result.error) throw result.error;
  return result.data.status as string;
}

async function cleanProjectPhotos() {
  const bucket = backend.storage.from('snag-photos');
  const folders = await bucket.list(projectId, { limit: 1000 });
  if (folders.error) throw folders.error;
  const paths: string[] = [];
  for (const folder of folders.data) {
    const files = await bucket.list(`${projectId}/${folder.name}`, { limit: 1000 });
    if (files.error) throw files.error;
    paths.push(...files.data.map((file: { name: string }) => `${projectId}/${folder.name}/${file.name}`));
  }
  if (paths.length) {
    const removed = await bucket.remove(paths);
    if (removed.error) throw removed.error;
  }
}

test.beforeAll(async () => {
  const project = await backend.from('projects').insert({ id: projectId, name: projectName, code: `O${Date.now()}`, created_by: users.admin, require_fix_photo: false });
  if (project.error) throw project.error;
  const memberships = await backend.from('project_members').insert([
    { project_id: projectId, user_id: users.manager, role: 'manager' },
    { project_id: projectId, user_id: users.member, role: 'member' },
  ]);
  if (memberships.error) throw memberships.error;
  const profile = await backend.from('profiles').select('full_name').eq('id', users.manager).single();
  if (profile.error) throw profile.error;
  managerName = profile.data.full_name;
  const auth = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@snagflow.test', password: 'Password123!' }),
  });
  if (!auth.ok) throw Error('Local manager fixture sign-in failed.');
  const session = await auth.json() as { access_token: string };
  manager = createClient(api!, anon!, { global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
});
test.afterAll(async () => {
  await cleanProjectPhotos();
  const removed = await backend.from('projects').delete().eq('id', projectId);
  if (removed.error) throw removed.error;
});

test('offline capture, photo, edit, comment and transition survive reload and reconnect exactly once', async ({ page }, info) => {
  test.setTimeout(180_000);
  const network = await partition(page);
  const title = `Durable site capture ${crypto.randomUUID()}`;
  await login(page);
  await page.goto(`/projects/${projectId}/capture`);
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  network.rest = network.auth = network.storage = true;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Prepared offline, including the original photo.');
  await page.getByRole('radio', { name: managerName, exact: true }).click();
  await addPhoto(page);
  await expect(page.getByText('Draft saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('Captured issue photo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  const id = page.url().split('/').pop()!;
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  const unsynced = await backend.from('snags').select('id').eq('id', id);
  if (unsynced.error) throw unsynced.error;
  expect(unsynced.data).toHaveLength(0);
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`${title} revised`);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await page.getByLabel('Comment', { exact: true }).fill('Offline inspection comment');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.goto('/sync');
  await expect(page.getByText('transition · Pending', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('transition · Pending', { exact: true })).toBeVisible();
  await expect(page.getByText(/Offline inspection comment/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('restarted-offline-queue.png'), fullPage: true });
  let uploadInterrupted = false;
  await page.route('**/storage/v1/object/snag-photos/**', async (route) => {
    if (!uploadInterrupted && route.request().method() === 'POST') {
      uploadInterrupted = true;
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.abort('connectionreset');
    } else await route.continue();
  });
  network.rest = network.auth = network.storage = false;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => status(id)).toBe('in_progress');
  const rows = await backend.from('snags').select('id,title,priority,number,client_id').eq('client_id', id);
  if (rows.error) throw rows.error;
  expect(rows.data).toHaveLength(1);
  expect(rows.data[0]).toMatchObject({ id, title: `${title} revised`, priority: 'medium' });
  expect(rows.data[0]!.number).toBeGreaterThan(0);
  const photos = await backend.from('snag_photos').select('id,width,height').eq('snag_id', id);
  const comments = await backend.from('comments').select('id').eq('snag_id', id).eq('body', 'Offline inspection comment');
  const activity = await backend.from('activity_log').select('id').eq('snag_id', id).eq('action', 'status_changed');
  if (photos.error || comments.error || activity.error) throw photos.error ?? comments.error ?? activity.error;
  expect(uploadInterrupted).toBe(true);
  expect(photos.data).toHaveLength(1); expect(comments.data).toHaveLength(1); expect(activity.data).toHaveLength(1);
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await page.reload();
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  const repeated = await backend.from('activity_log').select('id').eq('snag_id', id).eq('action', 'status_changed');
  if (repeated.error) throw repeated.error;
  expect(repeated.data).toHaveLength(1);
});

test('a deliberate remote workflow conflict retains intent for attention and discard', async ({ page }, info) => {
  const id = crypto.randomUUID();
  const title = `Conflict fixture ${crypto.randomUUID()}`;
  const inserted = await backend.from('snags').insert({ id, client_id: id, project_id: projectId, number: 0, title, created_by: users.member });
  if (inserted.error) throw inserted.error;
  const assigned = await manager.rpc('assign_snag', { p_snag_id: id, p_assignee_id: users.member });
  if (assigned.error) throw assigned.error;
  const network = await partition(page);
  await login(page, 'member1');
  await page.goto(`/snags/${id}`);
  await expect(page.getByRole('button', { name: 'Start work', exact: true })).toBeVisible();
  network.rest = network.auth = network.storage = true;
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  for (const next of ['in_progress', 'ready_for_review', 'closed']) {
    const result = await manager.rpc('transition_snag', { p_snag_id: id, p_to_status: next, p_comment: '' });
    if (result.error) throw result.error;
  }
  await page.goto('/sync');
  network.rest = network.auth = network.storage = false;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText('transition · Needs attention', { exact: true })).toBeVisible();
  await expect(page.getByText(/OFFLINE_CONFLICT/)).toBeVisible();
  await expect.poll(() => status(id)).toBe('closed');
  await page.reload();
  await expect(page.getByText('transition · Needs attention', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('conflict-attention.png'), fullPage: true });
  await page.getByRole('button', { name: 'Discard queued change', exact: true }).click();
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  await expect.poll(() => status(id)).toBe('closed');
});

test('lost committed create response replays one stable identity without duplicate rows', async ({ page }) => {
  const title = `Lost response ${crypto.randomUUID()}`;
  let interrupted = false;
  await login(page);
  await page.goto(`/projects/${projectId}/capture`);
  await page.route('**/rest/v1/rpc/apply_offline_mutation', async (route) => {
    const payload = route.request().postDataJSON() as { p_kind?: string };
    if (!interrupted && payload.p_kind === 'create') {
      interrupted = true;
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.abort('connectionreset');
    } else await route.continue();
  });
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  expect(interrupted).toBe(true);
  const id = page.url().split('/').pop()!;
  await page.goto('/sync');
  const retry = page.getByRole('button', { name: 'Retry now', exact: true });
  await expect(retry.or(page.getByText('No queued changes.', { exact: true }))).toBeVisible();
  if (await retry.isVisible()) await retry.click();
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  const rows = await backend.from('snags').select('id,client_id').eq('project_id', projectId).eq('title', title);
  if (rows.error) throw rows.error;
  expect(rows.data).toEqual([{ id, client_id: id }]);
});

test('queued capture remains isolated when switching accounts and deployment URLs', async ({ page }) => {
  test.setTimeout(180_000);
  const title = `Isolated queue ${crypto.randomUUID()}`;
  const network = await partition(page);
  await login(page);
  await page.goto(`/projects/${projectId}/capture`);
  network.rest = network.storage = true;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  await page.goto('/sync');
  await expect(page.getByText('create · Pending', { exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  network.rest = network.storage = false;
  await login(page, 'viewer');
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Open ${projectName}`, exact: true })).toHaveCount(0);
  await page.goto('/sync');
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  const absent = await backend.from('snags').select('id').eq('project_id', projectId).eq('title', title);
  if (absent.error) throw absent.error;
  expect(absent.data).toHaveLength(0);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  network.rest = network.storage = true;
  await login(page);
  await page.goto('/sync');
  await expect(page.getByText('create · Pending', { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(title))).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Change app URL', exact: true }).click();
  await expect(page.getByLabel('App URL', { exact: true })).toBeVisible();
  await page.getByLabel('App URL', { exact: true }).fill('http://localhost:3003');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Connected to http://localhost:3003', { exact: false })).toBeVisible();
  network.rest = network.storage = false;
  await login(page);
  await page.goto('/sync');
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(title))).toHaveCount(0);
  const stillAbsent = await backend.from('snags').select('id').eq('project_id', projectId).eq('title', title);
  if (stillAbsent.error) throw stillAbsent.error;
  expect(stillAbsent.data).toHaveLength(0);
  await page.goto('/');
  await page.getByRole('button', { name: 'Change app URL', exact: true }).click();
  await page.getByLabel('App URL', { exact: true }).fill('http://127.0.0.1:3003');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Connected to http://127.0.0.1:3003', { exact: false })).toBeVisible();
  network.rest = network.storage = true;
  await login(page);
  await page.goto('/sync');
  await expect(page.getByText('create · Pending', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard queued change', exact: true }).click();
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
});

test('a server without Phase6 RPCs preserves online capture, photos and workflow without claiming queued sync', async ({ page }) => {
  const title = `Phase17 online compatibility ${crypto.randomUUID()}`;
  let phase6Writes = 0;
  let directCreates = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/rest/v1/rpc/apply_offline_mutation') phase6Writes++;
    if (path === '/rest/v1/snags' && request.method() === 'POST') directCreates++;
  });
  await page.route('**/rest/v1/rpc/mobile_sync_snapshot', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.mobile_sync_snapshot in the schema cache' }),
  }));
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('manager@snagflow.test');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page.getByText('Offline sync needs a server update. Online changes remain available.', { exact: true })).toBeVisible();
  await page.goto(`/projects/${projectId}/capture`);
  await expect(page.getByText('Changes require a connection. Your draft stays on this screen if saving fails.', { exact: true })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Online capture remains available before the offline migration is deployed.');
  await page.getByRole('radio', { name: managerName, exact: true }).click();
  await addPhoto(page);
  await expect(page.getByText('Draft saved on this device', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Saving draft on this device…', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/queued uploads resume when connected/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  const id = page.url().split('/').pop()!;
  const created = await backend.from('snags').select('id,number,assignee_id').eq('id', id).single();
  if (created.error) throw created.error;
  expect(created.data.number).toBeGreaterThan(0);
  await expect(page.getByText(/pending sync/i)).toHaveCount(0);
  expect(created.data.assignee_id).toBe(users.manager);
  await expect(page.getByRole('img', { name: 'issue photo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`${title} revised`);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page.getByText(`${title} revised`, { exact: true })).toBeVisible();
  await page.getByLabel('Comment', { exact: true }).fill('Online comment before server upgrade');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByText('Online comment before server upgrade', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await expect.poll(() => status(id)).toBe('in_progress');
  const photos = await backend.from('snag_photos').select('id').eq('snag_id', id);
  const comments = await backend.from('comments').select('id').eq('snag_id', id).eq('body', 'Online comment before server upgrade');
  const updated = await backend.from('snags').select('title').eq('id', id).single();
  if (photos.error || comments.error || updated.error) throw photos.error ?? comments.error ?? updated.error;
  expect(photos.data).toHaveLength(1); expect(comments.data).toHaveLength(1);
  expect(updated.data.title).toBe(`${title} revised`);
  expect(phase6Writes).toBe(0);
  expect(directCreates).toBe(1);
  await page.goto('/sync');
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  await expect(page.getByText(/create · Pending|photos · Pending|transition · Pending/)).toHaveCount(0);
});
