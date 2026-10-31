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

const siteName = 'Lifecycle test site';
const snag = crypto.randomUUID();
const second = crypto.randomUUID();
const third = crypto.randomUUID();
const dialog = (page: Page) => page.getByRole('dialog');
test.beforeAll(async () => {
  await fixture('projects', 'POST', { id: project, name: siteName, code: prefix, created_by: admin });
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: member, role: 'member' },
    { project_id: project, user_id: viewer, role: 'viewer' },
  ]);
  await fixture('snags', 'POST', [snag, second, third].map((id, index) => ({
    id, client_id: id, project_id: project, title: `Lifecycle defect ${index + 1}`, created_by: member,
    assignee_id: member, status: index === 1 ? 'ready_for_review' : 'in_progress',
  })));
});
test.afterAll(async () => { await fixture(`projects?id=eq.${project}`, 'DELETE'); });

test('manager confirms archive/restore, preserves access, refreshes active navigation and work', async ({ page }) => {
  await login(page, 'manager');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('region', { name: 'Review queue' }).getByRole('link', { name: 'Lifecycle defect 2' })).toBeVisible();
  await page.goto(`/projects/${project}`);
  await page.getByRole('button', { name: 'Archive project', exact: true }).click();
  await expect(dialog(page)).toContainText(siteName);
  await page.screenshot({ path: '.playwright/lifecycle/archive-desktop.png' });
  await expect(dialog(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  expect((await (await fixture(`projects?id=eq.${project}`)).json())[0].status).toBe('active');
  await page.getByRole('button', { name: 'Archive project', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).not.toContainText(siteName);
  await expect(page.getByRole('region', { name: 'Review queue' }).getByRole('link', { name: 'Lifecycle defect 2' })).toHaveCount(0);
  await page.getByText('Archived projects', { exact: true }).click();
  await page.getByRole('main').getByRole('link', { name: siteName, exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Archived project' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lifecycle defect 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore project', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archive project', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toContainText(siteName);
});

test('member and viewer cannot see lifecycle controls', async ({ page }) => {
  for (const role of ['member1', 'viewer']) {
    await login(page, role);
    await page.goto(`/projects/${project}`);
    await expect(page.getByRole('button', { name: 'Archive project', exact: true })).toHaveCount(0);
    await page.goto(`/snags/${snag}`);
    await expect(page.getByRole('button', { name: 'Delete snag', exact: true })).toHaveCount(0);
  }
});

test('stale manager archive and deletion both fail without navigating or committing', async ({ page }) => {
  await login(page, 'manager');
  for (const operation of ['archive', 'delete']) {
    await page.goto(operation === 'archive' ? `/projects/${project}` : `/snags/${snag}`);
    await page.getByRole('button', { name: operation === 'archive' ? 'Archive project' : 'Delete snag', exact: true }).click();
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', { role: 'viewer' });
    try {
      await dialog(page).getByRole('button', { name: operation === 'archive' ? 'Confirm archive' : 'Confirm delete', exact: true }).click();
      await expect(dialog(page).getByRole('alert')).toBeFocused();
      await expect(dialog(page).getByRole('alert')).toContainText(/permission|access/i);
      expect((await (await fixture(`projects?id=eq.${project}`)).json())[0].status).toBe('active');
      expect((await (await fixture(`snags?id=eq.${snag}`)).json())[0].deleted_at).toBeNull();
    } finally {
      await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', { role: 'manager' });
    }
  }
});

test('confirmed soft delete refreshes list and dashboard; deleted detail/edit stay unavailable', async ({ page }) => {
  await login(page, 'manager');
  await page.goto(`/projects/${project}`);
  await page.getByRole('link', { name: 'Lifecycle defect 1' }).click();
  await page.getByRole('button', { name: 'Delete snag', exact: true }).click();
  await expect(dialog(page)).toContainText('Lifecycle defect 1');
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await (await fixture(`snags?id=eq.${snag}`)).json())[0].deleted_at).toBeNull();
  await page.getByRole('button', { name: 'Delete snag', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project}$`));
  await expect(page.getByRole('link', { name: 'Lifecycle defect 1' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Lifecycle defect 2' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Lifecycle defect 1', exact: true })).toHaveCount(0);
  expect((await (await fixture(`snags?id=eq.${snag}`)).json())[0].deleted_at).toBeTruthy();
  expect(await (await fixture(`activity_log?snag_id=eq.${snag}&action=eq.deleted`)).json()).toHaveLength(1);
  for (const path of [`/snags/${snag}`, `/snags/${snag}/edit`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Lifecycle defect 1', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete snag', exact: true })).toHaveCount(0);
  }
});

test('phone dialog reflows at enlarged text and network failure permits retry', async ({ page }) => {
  await login(page, 'admin');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/snags/${second}`);
  await page.addStyleTag({ content: 'html { font-size: 20px; }' });
  await page.getByRole('button', { name: 'Delete snag', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await page.screenshot({ path: '.playwright/lifecycle/delete-phone-large-text.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/*', async route => {
    if (route.request().headers()['next-action']) await route.abort('failed');
    else await route.continue();
  });
  await dialog(page).getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText(/connection|confirmed/i);
  await page.unroute('**/*');
  await dialog(page).getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project}$`));
});

test('lost committed delete response offers safe return to refreshed project without duplicate audit', async ({ page }) => {
  await login(page, 'manager');
  await page.goto(`/projects/${project}`);
  await page.getByRole('link', { name: 'Lifecycle defect 3' }).click();
  await page.getByRole('button', { name: 'Delete snag', exact: true }).click();
  let lost = false;
  await page.route('**/*', async route => {
    if (!lost && route.request().headers()['next-action']) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await dialog(page).getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('could not be confirmed');
  await page.unroute('**/*');
  expect((await (await fixture(`snags?id=eq.${third}`)).json())[0].deleted_at).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // Exercise the live hook's 250ms coalescing window while recovery is open.
  await page.waitForTimeout(500);
  await expect(dialog(page).getByRole('alert')).toContainText('could not be confirmed');
  await dialog(page).getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('already deleted');
  const beforeRecovery = await page.evaluate(() => performance.timeOrigin);
  await dialog(page).getByRole('link', { name: 'Return to project' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project}$`));
  // Recovery must discard the client route cache when the invalidation response was lost.
  await expect.poll(() => page.evaluate(() => performance.timeOrigin)).not.toBe(beforeRecovery);
  await expect(page.getByRole('link', { name: 'Lifecycle defect 3' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Lifecycle defect 3', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete snag', exact: true })).toHaveCount(0);
  expect(await (await fixture(`activity_log?snag_id=eq.${third}&action=eq.deleted`)).json()).toHaveLength(1);
});
