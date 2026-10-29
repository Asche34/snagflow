import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const settings: Record<string, string | undefined> = { ...process.env };
for (const file of ['../supabase/tests/test.env', '../supabase.env']) {
  if (!existsSync(resolve(file))) continue;
  for (const line of readFileSync(resolve(file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
    if (match && !settings[match[1]!]) settings[match[1]!] = match[2]!;
  }
}
const api = settings['SUPABASE_URL'] ?? settings['API_URL'];
const key = settings['SUPABASE_SERVICE_ROLE_KEY'] ?? settings['SERVICE_ROLE_KEY'];
const project = crypto.randomUUID();
const prefix = `P${Date.now().toString(36)}`;
const admin = '11111111-1111-4111-8111-111111111111';
const manager = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const viewer = '55555555-5555-4555-8555-555555555555';
async function fixture(resource: string, method = 'GET', body?: unknown) {
  if (!api || !key) throw new Error('Project E2E requires local Supabase credentials');
  const response = await fetch(`${api}/rest/v1/${resource}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`Project fixture ${method}: ${response.status} ${await response.text()}`);
  return response;
}
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
const input = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });
const alert = (page: Page) =>
  page.getByRole('form', { name: /project details/i }).getByRole('alert');
test.beforeAll(async () => {
  await fixture('projects', 'POST', {
    id: project,
    name: 'Project management test site',
    code: `${prefix}M`,
    created_by: admin,
  });
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: member, role: 'member' },
    { project_id: project, user_id: viewer, role: 'viewer' },
  ]);
});
test.afterAll(async () => {
  await fixture(`projects?code=like.${prefix}*`, 'DELETE');
});

test('admin creates a project and sees it in refreshed project navigation', async ({ page }) => {
  await login(page, 'admin');
  await page.getByRole('main').getByRole('link', { name: 'New project', exact: true }).click();
  await input(page, 'Project name').fill('New hospital wing');
  await input(page, 'Project code').fill(`${prefix}N`);
  await input(page, 'Description').fill('Handover for the new wing');
  await input(page, 'Client name').fill('Regional Health');
  await input(page, 'Address').fill('12 Site Road');
  await input(page, 'Require a fix photo before review').uncheck();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'New hospital wing', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toContainText(
    'New hospital wing',
  );
  const rows = await (await fixture(`projects?code=eq.${prefix}N`)).json();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    client_name: 'Regional Health',
    address: '12 Site Road',
    require_fix_photo: false,
    created_by: admin,
    status: 'active',
    snag_counter: 0,
  });
});

test('manager edits project details and the fix photo setting', async ({ page }) => {
  await login(page, 'manager');
  await expect(page.getByRole('link', { name: 'New project', exact: true })).toHaveCount(0);
  await page.goto(`/projects/${project}`);
  await page.getByRole('link', { name: 'Edit project', exact: true }).click();
  await input(page, 'Project name').fill('Updated management test site');
  await input(page, 'Client name').fill('Main contractor');
  await input(page, 'Description').fill('Updated handover notes');
  await input(page, 'Require a fix photo before review').uncheck();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Updated management test site', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Edit project', exact: true }).click();
  await expect(input(page, 'Client name')).toHaveValue('Main contractor');
  await expect(input(page, 'Description')).toHaveValue('Updated handover notes');
  await expect(input(page, 'Require a fix photo before review')).not.toBeChecked();
});

test('members and viewers cannot open create/edit forms, and manager cannot create', async ({
  page,
}) => {
  for (const role of ['member1', 'viewer', 'manager']) {
    await login(page, role);
    await page.goto('/projects/new');
    await expect(page.getByRole('heading', { name: 'New project', exact: true })).toHaveCount(0);
    if (role !== 'manager') {
      await page.goto(`/projects/${project}`);
      await expect(page.getByRole('link', { name: 'Edit project', exact: true })).toHaveCount(0);
      await page.goto(`/projects/${project}/edit`);
      await expect(page.getByRole('button', { name: 'Save project', exact: true })).toHaveCount(0);
    }
  }
});

test('invalid details and duplicate codes retain the draft and focus linked errors', async ({
  page,
}) => {
  await login(page, 'admin');
  await page.goto('/projects/new');
  await input(page, 'Project name').fill('Draft retained');
  await input(page, 'Project code').fill('bad code');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(alert(page)).toBeFocused();
  await expect(input(page, 'Project code')).toHaveAttribute('aria-invalid', 'true');
  await expect(input(page, 'Project name')).toHaveValue('Draft retained');
  await input(page, 'Project code').fill(`${prefix}M`);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(alert(page)).toContainText('already in use');
  await expect(input(page, 'Project name')).toHaveValue('Draft retained');
  const rows = await (await fixture(`projects?id=eq.${project}`)).json();
  expect(rows[0].name).not.toBe('Draft retained');
});

test('revoked manager access rejects an already loaded edit without discarding the draft', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto(`/projects/${project}/edit`);
  await input(page, 'Project name').fill('Must not be committed');
  await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
    role: 'viewer',
  });
  try {
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    await expect(alert(page)).toContainText('permission');
    await expect(input(page, 'Project name')).toHaveValue('Must not be committed');
    const rows = await (await fixture(`projects?id=eq.${project}`)).json();
    expect(rows[0].name).not.toBe('Must not be committed');
  } finally {
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
      role: 'manager',
    });
  }
});

test('lost create response reconciles revised draft details without a second project', async ({
  page,
}) => {
  await login(page, 'admin');
  await page.goto('/projects/new');
  await input(page, 'Project name').fill('Uncertain create');
  await input(page, 'Project code').fill(`${prefix}R`);
  let intercepted = false;
  await page.route('**/projects/new', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(alert(page)).toBeVisible();
  await input(page, 'Project name').fill('Recovered changed draft');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Recovered changed draft', exact: true }),
  ).toBeVisible();
  const rows = await (await fixture(`projects?code=eq.${prefix}R`)).json();
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe('Recovered changed draft');
});

test('project form reflows at phone/desktop widths and with enlarged text', async ({
  page,
}, testInfo) => {
  await login(page, 'admin');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects/new');
    await expect(input(page, 'Project name')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`project-form-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const submit = page.getByRole('button', { name: 'Create project', exact: true });
  await submit.focus();
  await submit.scrollIntoViewIfNeeded();
  const bounds = await submit.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Phone navigation' }).boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y);
});
