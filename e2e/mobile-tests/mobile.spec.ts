import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { createClient } = createRequire(new URL('../../supabase/package.json', import.meta.url))(
  '@supabase/supabase-js',
) as typeof import('../../supabase/node_modules/@supabase/supabase-js');

// Test-runner only; neither these credentials nor this client enter browser code.
const settings: Record<string, string> = {};
const envPath = fileURLToPath(new URL('../../supabase/tests/test.env', import.meta.url));
for (const line of (existsSync(envPath) ? readFileSync(envPath, 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
  if (match) settings[match[1]!] = match[2]!;
}
const api = process.env['SUPABASE_URL'] ?? settings['SUPABASE_URL'];
const serviceKey =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? settings['SUPABASE_SERVICE_ROLE_KEY'];
if (!api || !serviceKey) throw new Error('Local mobile E2E requires Supabase test credentials.');
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(api).hostname))
  throw new Error('Mobile E2E fixture writes are restricted to local Supabase.');
const backend = createClient(api, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const CREDS = {
  admin: 'admin@snagflow.test',
  manager: 'manager@snagflow.test',
  member1: 'member1@snagflow.test',
  viewer: 'viewer@snagflow.test',
};
const UIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  member1: '33333333-3333-4333-8333-333333333333',
  viewer: '55555555-5555-4555-8555-555555555555',
};
const TEST_PASSWORD = 'Password123!';

const projectId = crypto.randomUUID();
const projectName = `Mobile verification ${Date.now()}`;
const secondProjectId = crypto.randomUUID();
const secondProjectName = `Mobile switch target ${Date.now()}`;
const locationId = crypto.randomUUID(),
  categoryId = crypto.randomUUID();
let memberName = '';
async function login(page: Page, role: keyof typeof CREDS) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(CREDS[role]);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}
async function photo(page: Page, button = 'Choose photo') {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(0, 0, 2400, 1200);
    ctx.fillStyle = '#192d25';
    ctx.fillRect(100, 100, 400, 500);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button, exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'mobile-inspection.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  });
}
async function savedStatus(id: string, status: string) {
  await expect
    .poll(async () => {
      const r = await backend.from('snags').select('status').eq('id', id).single();
      if (r.error) throw r.error;
      return r.data.status;
    })
    .toBe(status);
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const inputs = page.getByRole('textbox');
  for (const input of await inputs.all()) {
    if (!(await input.isVisible())) continue;
    const bounds = await input.boundingBox();
    expect(
      bounds && bounds.x >= -1 && bounds.x + bounds.width <= page.viewportSize()!.width + 1,
    ).toBe(true);
  }
}

test.beforeAll(async () => {
  const project = await backend.from('projects').insert({
    id: projectId,
    name: projectName,
    code: `M${Date.now()}`,
    created_by: UIDS.admin,
    require_fix_photo: true,
  });
  if (project.error) throw project.error;
  const second = await backend.from('projects').insert({
    id: secondProjectId,
    name: secondProjectName,
    code: `S${Date.now()}`,
    created_by: UIDS.admin,
  });
  if (second.error) throw second.error;
  const secondMember = await backend.from('project_members').insert({
    project_id: secondProjectId,
    user_id: UIDS.member1,
    role: 'member',
  });
  if (secondMember.error) throw secondMember.error;
  const members = await backend.from('project_members').insert(
    (['manager', 'member1', 'viewer'] as const).map((role) => ({
      project_id: projectId,
      user_id: UIDS[role],
      role: role === 'member1' ? 'member' : role,
    })),
  );
  if (members.error) throw members.error;
  const location = await backend
    .from('locations')
    .insert({ id: locationId, project_id: projectId, name: 'Mobile plant room' });
  if (location.error) throw location.error;
  const category = await backend
    .from('categories')
    .insert({ id: categoryId, project_id: projectId, name: 'Mobile electrical' });
  if (category.error) throw category.error;
  const profile = await backend
    .from('profiles')
    .select('full_name')
    .eq('id', UIDS.member1)
    .single();
  if (profile.error) throw profile.error;
  memberName = profile.data.full_name;
});
test.afterAll(async () => {
  const bucket = backend.storage.from('snag-photos');
  const folders = await bucket.list(projectId, { limit: 1000 });
  if (folders.error) throw folders.error;
  const paths: string[] = [];
  for (const folder of folders.data) {
    const files = await bucket.list(`${projectId}/${folder.name}`, { limit: 1000 });
    if (files.error) throw files.error;
    paths.push(
      ...files.data.map((file: { name: string }) => `${projectId}/${folder.name}/${file.name}`),
    );
  }
  if (paths.length) {
    const removed = await bucket.remove(paths);
    if (removed.error) throw removed.error;
  }
  const deleted = await backend.from('projects').delete().in('id', [projectId, secondProjectId]);
  if (deleted.error) throw deleted.error;
});

test('projects lead the home screen and the project side menu switches projects', async ({
  page,
}, info) => {
  await login(page, 'member1');
  await expect(page.getByText('Fieldwork', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  const project = page.getByRole('button', { name: `Open ${projectName}`, exact: true });
  await expect(project).toBeVisible();
  const projectPosition = await project.boundingBox();
  const workPosition = await page.getByText('Your work', { exact: true }).boundingBox();
  expect(projectPosition && workPosition && projectPosition.y < workPosition.y).toBeTruthy();
  await project.click();
  await page.getByRole('button', { name: 'Switch project', exact: true }).click();
  await expect(
    page
      .getByRole('button', { name: `Switch to ${projectName}`, exact: true })
      .getByText('Current project', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: `Switch to ${secondProjectName}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${secondProjectId}$`));
  await expect(page.getByRole('heading', { name: secondProjectName, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close project menu', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Switch project', exact: true }).click();
  await page.screenshot({ path: info.outputPath('project-side-menu.png') });
  await page.getByRole('button', { name: 'Close project menu', exact: true }).click();
  await page.getByRole('button', { name: 'Switch project', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close project menu', exact: true })).toHaveCount(
    0,
  );
  await noHorizontalOverflow(page);
});

test('save and add another retains location/category but resets snag-specific inputs', async ({
  page,
}, info) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/capture`);
  await page.getByRole('radio', { name: 'Save & add another', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('First repeated capture');
  await page.getByLabel('Description', { exact: true }).fill('Only on the first snag');
  await page.getByRole('radio', { name: 'Mobile plant room', exact: true }).click();
  await page.getByRole('radio', { name: 'Mobile electrical', exact: true }).click();
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page.getByText(/Ready for the next capture/)).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('');
  await expect(page.getByRole('radio', { name: 'Mobile plant room', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Mobile electrical', exact: true })).toBeChecked();
  await expect(
    page.getByRole('radio', { name: 'Decide later (Medium default)', exact: true }),
  ).toBeChecked();
  await page.getByLabel('Title', { exact: true }).fill('Second repeated capture');
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
  const rows = await backend
    .from('snags')
    .select('id,title,location_id,category_id,priority')
    .eq('project_id', projectId)
    .in('title', ['First repeated capture', 'Second repeated capture']);
  if (rows.error) throw rows.error;
  expect(rows.data).toHaveLength(2);
  expect(new Set(rows.data.map((row: { id: string }) => row.id)).size).toBe(2);
  for (const row of rows.data) {
    expect(row.location_id).toBe(locationId);
    expect(row.category_id).toBe(categoryId);
    expect(row.priority).toBe('medium');
  }
  await page.screenshot({ path: info.outputPath('retained-capture-fields.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch project', exact: true }).click();
  await page.getByRole('button', { name: `Switch to ${secondProjectName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Capture snag', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'No location', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'No category', exact: true })).toBeChecked();
});

test('project switching is blocked while a capture save is pending', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/capture`);
  await page.getByLabel('Title', { exact: true }).fill('Delayed capture project guard');
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route('**/rest/v1/rpc/apply_offline_mutation', async (route) => {
    const payload = route.request().postDataJSON() as { p_kind?: string };
    if (route.request().method() === 'POST' && payload.p_kind === 'create') {
      started();
      await gate;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await pending;
  try {
    await expect(page.getByRole('button', { name: 'Switch project', exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  await expect(page.getByRole('button', { name: 'Switch project', exact: true })).toBeEnabled();
});

test('phone login reports invalid credentials, signs in and signs out', async ({ page }, info) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email', { exact: true }).fill(CREDS.manager);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to sign in');
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath('phone-home.png'), fullPage: true });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/projects/${projectId}`);
  await expect(page).toHaveURL(/\/login/);
});

test('viewer sees project data with creation, reports and review controls gated', async ({
  page,
}) => {
  await login(page, 'viewer');
  await expect(page.getByRole('radio', { name: 'Ready for review', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: `Open ${projectName}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: projectName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch project', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Switch to ${secondProjectName}`, exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Close project menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Capture snag', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reports', exact: true })).toHaveCount(0);
  await page.goto(`/projects/${projectId}/capture`);
  await expect(
    page.getByText('You do not have permission to create snags in this project.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save snag', exact: true })).toHaveCount(0);
});

test('project filters apply together and can be cleared from the results', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByText('Filter snags', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('radio', { name: 'Mobile plant room', exact: true }).click();
  await page.getByRole('radio', { name: 'Mobile electrical', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filters (2)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mobile plant room ×', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filters (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
});

test('member and manager complete photo, editing, assignment, comment and reject/resubmit/approve loop', async ({
  page,
  browser,
  baseURL,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/capture`);
  await page.getByLabel('Title', { exact: true }).fill('Mobile socket defect');
  await photo(page);
  await expect(page.getByText('Review photo', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Captured issue photo', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Continue with photo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue with photo', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Mobile socket defect');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Loose socket cover captured on site.');
  await page.getByRole('radio', { name: 'high', exact: true }).click();
  await page.getByRole('radio', { name: 'Mobile plant room', exact: true }).click();
  await page.getByRole('radio', { name: 'Mobile electrical', exact: true }).click();
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  const id = page.url().split('/').pop()!;
  await expect(page.getByText('Mobile socket defect', { exact: true })).toBeVisible();
  const photos = await backend.from('snag_photos').select('*').eq('snag_id', id);
  if (photos.error) throw photos.error;
  expect(photos.data).toHaveLength(1);
  expect(photos.data[0]).toMatchObject({ width: 1600, height: 800, kind: 'issue' });
  await expect(page.getByRole('img', { name: 'issue photo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Mobile socket defect revised');
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page.getByText('Mobile socket defect revised', { exact: true })).toBeVisible();
  await page.getByLabel('Comment', { exact: true }).fill('Needs isolation before repair.');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByText('Needs isolation before repair.', { exact: true })).toBeVisible();
  const managerContext = await browser.newContext({
    baseURL: baseURL!,
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const manager = await managerContext.newPage();
    manager.on('pageerror', (error) => errors.push(error.message));
    await login(manager, 'manager');
    await manager.goto(`/snags/${id}`);
    await manager.getByRole('radio', { name: memberName, exact: true }).click();
    await manager.getByRole('button', { name: 'Save assignment', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await backend.from('snags').select('assignee_id').eq('id', id).single()).data
            ?.assignee_id,
      )
      .toBe(UIDS.member1);
    await page.reload();
    await page.getByRole('button', { name: 'Start work', exact: true }).click();
    await savedStatus(id, 'in_progress');
    await expect(
      page.getByRole('button', { name: 'Mark ready for review', exact: true }),
    ).toBeDisabled();
    await photo(page);
    await expect(
      page.getByRole('button', { name: 'Upload / retry photos', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Upload / retry photos', exact: true }).click();
    await expect(page.getByRole('img', { name: 'fix photo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mark ready for review', exact: true }).click();
    await savedStatus(id, 'ready_for_review');
    await expect(page.getByRole('button', { name: 'Approve and close', exact: true })).toHaveCount(
      0,
    );
    await manager.reload();
    await expect(
      manager.getByRole('button', { name: 'Reject back to assignee', exact: true }),
    ).toBeDisabled();
    await manager
      .getByLabel('Review / reopen reason', { exact: true })
      .fill('Cover still moves; tighten fixing.');
    await manager.getByRole('button', { name: 'Reject back to assignee', exact: true }).click();
    await savedStatus(id, 'in_progress');
    await page.reload();
    await expect(
      page.getByText('Cover still moves; tighten fixing.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mark ready for review', exact: true }).click();
    await savedStatus(id, 'ready_for_review');
    await manager.reload();
    await manager.getByRole('button', { name: 'Approve and close', exact: true }).click();
    await savedStatus(id, 'closed');
    await expect(manager.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
    await manager.screenshot({ path: info.outputPath('phone-closed-snag.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await managerContext.close();
  }
});

test('failed create transport retains durable details and syncs exactly once on retry', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/capture`);
  const title = `Retained mobile draft ${crypto.randomUUID()}`;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page
    .getByLabel('Description', { exact: true })
    .fill('Keep this draft through a failed request.');
  let blocked = false;
  await page.route('**/rest/v1/rpc/apply_offline_mutation', async (route) => {
    const payload = route.request().postDataJSON() as { p_kind?: string };
    if (!blocked && route.request().method() === 'POST' && payload.p_kind === 'create') {
      blocked = true;
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText('Keep this draft through a failed request.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sync and queued work', exact: true }).click();
  const retry = page.getByRole('button', { name: 'Retry now', exact: true });
  await expect(retry.or(page.getByText('No queued changes.', { exact: true }))).toBeVisible();
  if (await retry.isVisible()) await retry.click();
  await expect(page.getByText('No queued changes.', { exact: true })).toBeVisible();
  const rows = await backend
    .from('snags')
    .select('id')
    .eq('project_id', projectId)
    .eq('title', title);
  if (rows.error) throw rows.error;
  expect(rows.data).toHaveLength(1);
  expect(blocked).toBe(true);
});

test('capture remains usable at landscape and enlarged phone text', async ({ page }, info) => {
  await login(page, 'manager');
  await page.goto(`/projects/${projectId}/capture`);
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 812, height: 375 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath('landscape-capture.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll<HTMLElement>('input,textarea,[dir="auto"]')) {
      const style = getComputedStyle(node);
      const size = parseFloat(style.fontSize);
      if (!Number.isFinite(size)) continue;
      node.style.fontSize = `${size * 1.5}px`;
      node.style.lineHeight = `${size * 1.5 * 1.5}px`;
    }
  });
  await noHorizontalOverflow(page);
  await page.getByLabel('Title', { exact: true }).fill('Large text draft');
  await expect(page.getByRole('button', { name: 'Save snag', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('phone-enlarged-capture.png'), fullPage: true });
});
