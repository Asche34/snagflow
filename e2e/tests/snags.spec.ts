import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test.setTimeout(60_000);

// Disposable backend fixtures; browser writes still use the real signed-in user.
const settings: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  ),
};
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
const locationId = crypto.randomUUID();
const categoryId = crypto.randomUUID();
const ids = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  member1: '33333333-3333-4333-8333-333333333333',
  member2: '44444444-4444-4444-8444-444444444444',
  viewer: '55555555-5555-4555-8555-555555555555',
};
async function fixture(path: string, method = 'GET', body?: unknown) {
  if (!api || !serviceKey) throw new Error('Capture E2E requires local Supabase credentials');
  const result = await fetch(`${api}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!result.ok)
    throw new Error(`Fixture ${method} failed: ${result.status} ${await result.text()}`);
  return result;
}
async function login(page: Page, name: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${name}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.beforeAll(async () => {
  await fixture('projects', 'POST', {
    id: projectId,
    name: 'Capture test site',
    code: `C${Date.now()}`,
    created_by: ids.admin,
  });
  await fixture(
    'project_members',
    'POST',
    (['manager', 'member1', 'member2', 'viewer'] as const).map((name) => ({
      project_id: projectId,
      user_id: ids[name],
      role: name.startsWith('member') ? 'member' : name,
    })),
  );
  await fixture('locations', 'POST', { id: locationId, project_id: projectId, name: 'Plant room' });
  await fixture('categories', 'POST', {
    id: categoryId,
    project_id: projectId,
    name: 'Electrical',
  });
});
test.afterAll(async () => {
  // Storage cleanup is added with the photo scenarios; projects cascade relational fixtures.
  await fixture(`projects?id=eq.${projectId}`, 'DELETE');
});

test('member creates and edits a snag with project-local details', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('link', { name: 'New snag', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Loose outlet cover');
  await page.getByLabel('Description', { exact: true }).fill('Cover moves when touched.');
  await page.getByLabel('Location', { exact: true }).selectOption(locationId);
  await page.getByLabel('Category', { exact: true }).selectOption(categoryId);
  await page.getByLabel('Priority', { exact: true }).selectOption('high');
  await page.getByLabel('Due date', { exact: true }).fill('2026-12-15');
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  await expect(
    page.getByRole('heading', { name: 'Loose outlet cover', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Edit snag', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Replace outlet cover');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Replace outlet cover', exact: true }),
  ).toBeVisible();
});

test('save and add another starts a fresh draft without duplicate first snag', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  const title = `Repeat capture ${crypto.randomUUID()}`;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Save & add another', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
  await expect(page.getByRole('status')).toContainText('Snag saved');
  const response = await fixture(
    `snags?project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&select=id`,
  );
  expect(await response.json()).toHaveLength(1);
});

test('manager assigns and reassigns without changing status', async ({ page }) => {
  await login(page, 'manager');
  await page.goto(`/projects/${projectId}/snags/new`);
  await page.getByLabel('Title', { exact: true }).fill('Assign a repair');
  await page.getByLabel('Assignee', { exact: true }).selectOption(ids.member1);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  await page.getByLabel('Assign to', { exact: true }).selectOption(ids.member2);
  await page.getByRole('button', { name: 'Update assignment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Assignment updated');
  const snagId = page.url().split('/').pop();
  const response = await fixture(`snags?id=eq.${snagId}&select=status,assignee_id`);
  expect(await response.json()).toEqual([{ status: 'open', assignee_id: ids.member2 }]);
});

test('viewer cannot reach creation and another creator cannot edit', async ({ page, browser }) => {
  await login(page, 'viewer');
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('link', { name: 'New snag', exact: true })).toHaveCount(0);
  await page.goto(`/projects/${projectId}/snags/new`);
  await expect(page.getByRole('button', { name: 'Save snag', exact: true })).toHaveCount(0);
  const snagId = crypto.randomUUID();
  await fixture('snags', 'POST', {
    id: snagId,
    project_id: projectId,
    title: 'Other creator',
    created_by: ids.member1,
  });
  const context = await browser.newContext();
  const memberPage = await context.newPage();
  await login(memberPage, 'member2');
  await memberPage.goto(`/snags/${snagId}`);
  await expect(memberPage.getByRole('link', { name: 'Edit snag', exact: true })).toHaveCount(0);
  await memberPage.goto(`/snags/${snagId}/edit`);
  await expect(memberPage.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(
    0,
  );
  await context.close();
});

test('validation failure preserves typed details and focuses the error summary', async ({
  page,
}) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByLabel('Description', { exact: true }).fill('Keep these inspection notes');
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  const summary = page.locator('form [role="alert"]');
  await expect(summary).toBeVisible();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
    'Keep these inspection notes',
  );
  await expect(summary).toBeFocused();
});
