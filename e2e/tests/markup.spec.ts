import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test.setTimeout(75_000);
const settings: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
for (const file of ['../supabase/tests/test.env', '../supabase.env']) {
  if (!existsSync(resolve(file))) continue;
  for (const line of readFileSync(resolve(file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
    if (match && !settings[match[1]!]) settings[match[1]!] = match[2]!;
  }
}
const api = settings['SUPABASE_URL'] ?? settings['API_URL'];
const serviceKey = settings['SUPABASE_SERVICE_ROLE_KEY'] ?? settings['SERVICE_ROLE_KEY'];
const projectId = crypto.randomUUID();
const ids = { admin: '11111111-1111-4111-8111-111111111111', manager: '22222222-2222-4222-8222-222222222222', member1: '33333333-3333-4333-8333-333333333333', member2: '44444444-4444-4444-8444-444444444444', viewer: '55555555-5555-4555-8555-555555555555' };
const paths = new Set<string>();
let snagId: string;
let photoId: string;
let originalPath: string;
let originalBytes: Buffer;
type Photo = { id: string; storage_path: string; annotated_path: string | null; updated_at: string; annotation_json: { version: number; width: number; height: number; objects: { type: string; text?: string; x: number; y: number }[] } | null };
function headers() {
  if (!api || !serviceKey) throw new Error('Markup E2E requires local Supabase credentials');
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
async function fixture(path: string, method = 'GET', body?: unknown) {
  const result = await fetch(`${api}/rest/v1/${path}`, { method, headers: headers(), body: body === undefined ? null : JSON.stringify(body) });
  if (!result.ok) throw new Error(`Markup fixture ${method}: ${result.status} ${await result.text()}`);
  return result;
}
async function photo(): Promise<Photo> {
  const result = await fixture(`snag_photos?id=eq.${photoId}&select=*`);
  const rows: Photo[] = await result.json();
  if (!rows[0]) throw new Error('Missing markup fixture photo');
  if (rows[0].annotated_path) paths.add(rows[0].annotated_path);
  return rows[0];
}
async function login(page: Page, name: keyof typeof ids) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${name}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
async function open(page: Page) {
  await page.goto(`/snags/${snagId}`);
  await page.getByRole('button', { name: 'Edit markup', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Photo markup' });
  await expect(dialog.getByRole('button', { name: 'Save markup', exact: true })).toBeEnabled();
  return dialog;
}
async function insert(page: Page, tool: string, label?: string) {
  const dialog = page.getByRole('dialog', { name: 'Photo markup' });
  await dialog.getByRole('button', { name: tool, exact: true }).click();
  if (label) await dialog.getByLabel('Text or measurement label', { exact: true }).fill(label);
  await dialog.getByRole('button', { name: 'Add selected tool', exact: true }).click();
}

test.beforeAll(async () => {
  await fixture('projects', 'POST', { id: projectId, name: 'Markup test site', code: `M${Date.now()}`, created_by: ids.admin });
  await fixture('project_members', 'POST', (['manager', 'member1', 'member2', 'viewer'] as const).map((name) => ({ project_id: projectId, user_id: ids[name], role: name.startsWith('member') ? 'member' : name })));
});
test.beforeEach(async ({ page }) => {
  snagId = crypto.randomUUID(); photoId = crypto.randomUUID(); originalPath = `${projectId}/${snagId}/${photoId}.jpg`; paths.add(originalPath);
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#e4dfd4'; context.fillRect(0, 0, 800, 600); context.fillStyle = '#5e7167'; context.fillRect(150, 100, 300, 250);
    return canvas.toDataURL('image/jpeg', .9).split(',')[1]!;
  });
  originalBytes = Buffer.from(base64, 'base64');
  await fixture('snags', 'POST', { id: snagId, client_id: crypto.randomUUID(), project_id: projectId, title: 'Cracked wall tile', created_by: ids.member1 });
  const upload = await fetch(`${api}/storage/v1/object/snag-photos/${originalPath}`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'image/jpeg' }, body: originalBytes });
  if (!upload.ok) throw new Error(`Markup original upload: ${upload.status}`);
  await fixture('snag_photos', 'POST', { id: photoId, snag_id: snagId, kind: 'issue', storage_path: originalPath, width: 800, height: 600, uploaded_by: ids.member1, sort_order: 0 });
});
test.afterAll(async () => {
  // Include abandoned upload identities from transport-failure cases.
  const listed = await fetch(`${api}/storage/v1/object/list/snag-photos`, { method: 'POST', headers: headers(), body: JSON.stringify({ prefix: projectId, limit: 1000 }) });
  if (!listed.ok) throw new Error('Markup cleanup listing failed');
  const folders: { name: string }[] = await listed.json();
  for (const folder of folders) {
    const list = await fetch(`${api}/storage/v1/object/list/snag-photos`, { method: 'POST', headers: headers(), body: JSON.stringify({ prefix: `${projectId}/${folder.name}`, limit: 1000 }) });
    if (!list.ok) throw new Error('Markup cleanup child listing failed');
    const objects: { name: string }[] = await list.json();
    for (const object of objects) paths.add(`${projectId}/${folder.name}/${object.name}`);
  }
  if (paths.size) {
    const removal = await fetch(`${api}/storage/v1/object/snag-photos`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ prefixes: [...paths] }) });
    if (!removal.ok) throw new Error('Markup object cleanup failed');
  }
  await fixture(`projects?id=eq.${projectId}`, 'DELETE');
});

test('all tools remain editable and save separate original, vector and flattened JPEG', async ({ page }) => {
  await login(page, 'member1'); const dialog = await open(page);
  for (const tool of ['Pen', 'Arrow', 'Circle', 'Rectangle', 'Text', 'Measurement']) await insert(page, tool, tool === 'Measurement' ? '120 mm' : 'Replace tile');
  const objects = dialog.getByRole('combobox', { name: 'Select an object', exact: true });
  await expect(objects.locator('option')).toHaveCount(7);
  await dialog.getByRole('button', { name: 'Move right', exact: true }).click();
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Redo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save markup', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Markup saved' })).toBeVisible();
  const saved = await photo();
  expect(saved.storage_path).toBe(originalPath); expect(saved.annotated_path).not.toBe(originalPath);
  expect(saved.annotation_json?.objects.map((object) => object.type)).toEqual(['pen', 'arrow', 'circle', 'rectangle', 'text', 'measurement']);
  const original = await fetch(`${api}/storage/v1/object/authenticated/snag-photos/${originalPath}`, { headers: headers() });
  expect(Buffer.from(await original.arrayBuffer())).toEqual(originalBytes);
  const flattened = await fetch(`${api}/storage/v1/object/authenticated/snag-photos/${saved.annotated_path}`, { headers: headers() });
  const flattenedBytes = Buffer.from(await flattened.arrayBuffer());
  expect(flattenedBytes.subarray(0, 2).toString('hex')).toBe('ffd8');
  expect(flattenedBytes.equals(originalBytes)).toBe(false);
  const dimensions = await page.evaluate(async (base64) => { const image = new Image(); image.src = `data:image/jpeg;base64,${base64}`; await image.decode(); return [image.naturalWidth, image.naturalHeight]; }, flattenedBytes.toString('base64'));
  expect(dimensions).toEqual([800, 600]);
  await dialog.getByRole('button', { name: 'Close editor', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open issue photo 1', exact: true })).toHaveAttribute('href', new RegExp(saved.annotated_path!.split('/').at(-1)!));
  await page.reload(); const reopened = await open(page); await expect(reopened.getByRole('combobox', { name: 'Select an object', exact: true }).locator('option')).toHaveCount(7);
  await reopened.getByRole('combobox', { name: 'Select an object', exact: true }).selectOption({ index: 1 });
  await reopened.getByRole('button', { name: 'Delete selected object', exact: true }).click();
  await reopened.getByRole('button', { name: 'Save markup', exact: true }).click();
  await expect.poll(async () => (await photo()).annotation_json?.objects.length).toBe(5);
});

test('pointer drawing records freehand strokes and directional arrow geometry', async ({ page }) => {
  await login(page, 'member1'); const dialog = await open(page);
  const canvas = dialog.getByRole('group', { name: /Photo markup canvas/ }).locator('canvas').first();
  await dialog.getByRole('button', { name: 'Pen', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const penBox = await canvas.boundingBox(); if (!penBox) throw new Error('Markup canvas has no bounds');
  await page.mouse.move(penBox.x + penBox.width * .2, penBox.y + penBox.height * .3); await page.mouse.down();
  await page.mouse.move(penBox.x + penBox.width * .4, penBox.y + penBox.height * .4, { steps: 8 }); await page.mouse.up();
  await dialog.getByRole('button', { name: 'Arrow', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const arrowBox = await canvas.boundingBox(); if (!arrowBox) throw new Error('Markup canvas has no bounds');
  await page.mouse.move(arrowBox.x + arrowBox.width * .75, arrowBox.y + arrowBox.height * .7); await page.mouse.down();
  await page.mouse.move(arrowBox.x + arrowBox.width * .5, arrowBox.y + arrowBox.height * .5, { steps: 5 }); await page.mouse.up();
  await dialog.getByRole('button', { name: 'Save markup', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Markup saved' })).toBeVisible();
  const saved = await photo();
  expect(saved.annotation_json?.objects.map((object) => object.type)).toEqual(['pen', 'arrow']);
  const geometry = saved.annotation_json?.objects as ({ type: string; points: number[] }[] | undefined);
  expect(geometry?.[0]?.points.length).toBeGreaterThan(4);
  expect(geometry?.[1]?.points[0]).toBeGreaterThan(geometry?.[1]?.points[2] ?? Infinity);
});

test('viewer and other uploader cannot edit; managers can and revoked membership loses controls', async ({ page, browser }) => {
  await login(page, 'member2'); await page.goto(`/snags/${snagId}`); await expect(page.getByRole('button', { name: 'Edit markup', exact: true })).toHaveCount(0);
  for (const name of ['viewer', 'manager', 'member1'] as const) {
    const context = await browser.newContext(); const other = await context.newPage(); await login(other, name); await other.goto(`/snags/${snagId}`);
    await expect(other.getByRole('button', { name: 'Edit markup', exact: true })).toHaveCount(name === 'viewer' ? 0 : 1);
    if (name === 'member1') {
      await fixture(`project_members?project_id=eq.${projectId}&user_id=eq.${ids.member1}`, 'PATCH', { role: 'viewer' });
      await other.reload(); await expect(other.getByRole('button', { name: 'Edit markup', exact: true })).toHaveCount(0);
      await fixture(`project_members?project_id=eq.${projectId}&user_id=eq.${ids.member1}`, 'PATCH', { role: 'member' });
    }
    await context.close();
  }
});

test('concurrent editors retain drafts and require review before explicitly replacing latest markup', async ({ page, browser }) => {
  await login(page, 'member1'); const local = await open(page); await insert(page, 'Text', 'My retained draft');
  const context = await browser.newContext(); const other = await context.newPage(); await login(other, 'manager'); const remote = await open(other); await insert(other, 'Text', 'Manager saved first');
  await remote.getByRole('button', { name: 'Save markup', exact: true }).click(); await expect(remote.getByRole('status').filter({ hasText: 'Markup saved' })).toBeVisible();
  await local.getByRole('button', { name: 'Save markup', exact: true }).click();
  await expect(local.getByRole('alert')).toContainText('Someone saved newer markup');
  await expect(local.getByLabel('Selected object label', { exact: true })).toHaveValue('My retained draft');
  expect((await photo()).annotation_json?.objects[0]?.text).toBe('Manager saved first');
  await expect(local.getByRole('button', { name: 'Replace latest markup with draft', exact: true })).toBeDisabled();
  await local.getByRole('checkbox').check(); await local.getByRole('button', { name: 'Replace latest markup with draft', exact: true }).click();
  await expect.poll(async () => (await photo()).annotation_json?.objects[0]?.text).toBe('My retained draft');
  expect((await photo()).storage_path).toBe(originalPath); await context.close();
});

test('lost committed save response retries the same image identity and retained draft', async ({ page }) => {
  await login(page, 'member1'); const dialog = await open(page); await insert(page, 'Text', 'Stable retry draft');
  let interrupted = false;
  await page.route(`**/snags/${snagId}`, async (route) => {
    if (!interrupted && route.request().method() === 'POST' && route.request().headers()['next-action']) { interrupted = true; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Save markup', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible(); const committed = await photo(); expect(committed.annotated_path).toBeTruthy();
  await dialog.getByRole('button', { name: 'Save markup', exact: true }).click(); await expect(dialog.getByRole('status').filter({ hasText: 'Markup saved' })).toBeVisible();
  const retried = await photo(); expect(retried.annotated_path).toBe(committed.annotated_path); expect(retried.updated_at).toBe(committed.updated_at);
});

test('phone layout, keyboard movement, failed image recovery and closing preserve editable drafts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, 'member1'); const dialog = await open(page);
  await insert(page, 'Rectangle'); await dialog.getByRole('group', { name: /Photo markup canvas/ }).focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
  await dialog.getByRole('button', { name: 'Close editor', exact: true }).click(); await page.getByRole('button', { name: 'Edit markup', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Select an object', exact: true }).locator('option')).toHaveCount(2);
  await dialog.getByRole('combobox', { name: 'Select an object', exact: true }).selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Save markup', exact: true }).click(); await expect(dialog.getByRole('status').filter({ hasText: 'Markup saved' })).toBeVisible();
  expect((await photo()).annotation_json?.objects[0]).toMatchObject({ x: 201, y: 160 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.playwright/phase4-markup/phone-editor.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Close editor', exact: true }).click();
  let block = true; await page.route('**/storage/v1/object/sign/snag-photos/**', (route) => block ? route.abort('failed') : route.continue());
  await page.reload(); await expect(page.getByText(/signed link may have expired/)).toBeVisible(); block = false;
  await page.getByRole('button', { name: 'Refresh photo links', exact: true }).click(); await expect(page.getByRole('img', { name: 'Issue photo 1', exact: true })).toBeVisible();
});

test('unsupported stored annotation data is readable and requires an explicit fresh draft', async ({ page }) => {
  await fixture(`snag_photos?id=eq.${photoId}`, 'PATCH', { annotation_json: { version: 99, unknown: 'unsupported' } });
  await login(page, 'member1'); await page.goto(`/snags/${snagId}`); await page.getByRole('button', { name: 'Edit markup', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Photo markup' }); await expect(dialog.getByText(/unsupported format/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save markup', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Start a new markup draft', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Save markup', exact: true })).toBeEnabled();
});
