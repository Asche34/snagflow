import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Service credentials only prepare/clean disposable fixtures. All assertions use real user sessions.
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
const location = crypto.randomUUID();
const category = crypto.randomUUID();
const manager = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const path = `/projects/${project}`;
const calendar = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
async function fixture(resource: string, method = 'GET', body?: unknown) {
  if (!api || !key) throw new Error('Filters E2E requires local Supabase credentials');
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
    throw new Error(`Filter fixture ${method}: ${response.status} ${await response.text()}`);
  return response;
}
async function login(page: Page, name = 'manager') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${name}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
const list = (page: Page) => page.getByRole('list', { name: 'Snag list', exact: true });
test.beforeAll(async () => {
  await fixture('projects', 'POST', {
    id: project,
    name: 'Search test site',
    code: `F${Date.now()}`,
    created_by: manager,
  });
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: member, role: 'member' },
  ]);
  await fixture('locations', 'POST', { id: location, project_id: project, name: 'West stairwell' });
  await fixture('categories', 'POST', { id: category, project_id: project, name: 'Doors' });
  await fixture(
    'snags',
    'POST',
    [
      {
        title: 'Cracked fire door',
        description: 'Hinges require replacement',
        priority: 'critical',
        assignee_id: member,
        location_id: location,
        category_id: category,
        due_date: calendar(-1),
        created_by: manager,
      },
      {
        title: 'Scuffed panel',
        description: 'Fire door paint finish',
        priority: 'low',
        due_date: calendar(0),
        created_by: member,
      },
      { title: 'Loose railing', priority: 'high', due_date: calendar(7), created_by: manager },
      {
        title: 'Ceiling inspection',
        priority: 'medium',
        assignee_id: manager,
        due_date: calendar(8),
        created_by: member,
      },
      { title: 'Unscheduled check', priority: 'medium', created_by: member },
      {
        title: 'Closed door',
        status: 'closed',
        closed_at: new Date().toISOString(),
        priority: 'medium',
        due_date: calendar(-1),
        created_by: member,
      },
      ...Array.from({ length: 51 }, (_, i) => ({
        title: `Routine inspection ${i + 1}`,
        priority: 'low',
        created_by: member,
      })),
    ].map((row) => ({
      description: null,
      status: 'open',
      closed_at: null,
      assignee_id: null,
      location_id: null,
      category_id: null,
      due_date: null,
      ...row,
      project_id: project,
    })),
  );
});
test.afterAll(async () => {
  await fixture(`projects?id=eq.${project}`, 'DELETE');
});

test('combines labeled filters and restores them across sections, reload and clear', async ({
  page,
}) => {
  await login(page);
  await page.goto(path);
  await page.getByLabel('Search snags', { exact: true }).fill('hinges');
  await page.getByLabel('Status', { exact: true }).selectOption('open');
  await page.getByLabel('Priority', { exact: true }).selectOption('critical');
  await page.getByLabel('Assignee', { exact: true }).selectOption(member);
  await page.getByLabel('Location', { exact: true }).selectOption(location);
  await page.getByLabel('Category', { exact: true }).selectOption(category);
  await page.getByLabel('Due date', { exact: true }).selectOption('overdue');
  await page.getByLabel('Created by me', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText('Cracked fire door');
  const filtered = page.url();
  await page.getByRole('link', { name: 'Locations', exact: true }).click();
  await page.getByRole('link', { name: 'Snags', exact: true }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('Search snags', { exact: true })).toHaveValue('hinges');
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('critical');
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(50);
  await page.goBack();
  await expect(page).toHaveURL(filtered);
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
});

test('searches combined title/description, stems words, finds numbers and safely handles punctuation', async ({
  page,
}) => {
  await login(page);
  for (const [query, title] of [
    ['cracked hinges', 'Cracked fire door'],
    ['replacing', 'Cracked fire door'],
    ['#2', 'Scuffed panel'],
    ['2', 'Scuffed panel'],
  ]) {
    await page.goto(`${path}?q=${encodeURIComponent(query!)}`);
    await expect(list(page).getByRole('listitem')).toHaveCount(1);
    await expect(list(page)).toContainText(title!);
  }
  await page.goto(`${path}?q=${encodeURIComponent('"),number.gt.0,("')}`);
  await expect(page.getByText('No snags match these filters.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Search test site' })).toBeVisible();
});

test('due presets have exact calendar boundaries and sorting places undated snags last', async ({
  page,
}) => {
  await login(page);
  for (const [due, title] of [
    ['overdue', 'Cracked fire door'],
    ['today', 'Scuffed panel'],
    ['week', 'Loose railing'],
  ]) {
    await page.goto(`${path}?due=${due}`);
    await expect(list(page)).toContainText(title!);
    await expect(list(page)).not.toContainText('Ceiling inspection');
    await expect(list(page)).not.toContainText('Closed door');
  }
  await page.goto(`${path}?due=none`);
  await expect(list(page)).toContainText('Unscheduled check');
  await expect(list(page)).not.toContainText('Cracked fire door');
  await page.goto(`${path}?sort=due`);
  await expect(list(page).getByRole('listitem').first()).toContainText('Cracked fire door');
  await page.goto(`${path}?sort=priority`);
  await expect(list(page).getByRole('listitem').first()).toContainText('Cracked fire door');
  await expect(list(page).getByRole('listitem').nth(1)).toContainText('Loose railing');
});

test('pagination retains filters and normalizes malformed, repeated and stale URL values', async ({
  page,
}) => {
  await login(page);
  await page.goto(`${path}?priority=low&sort=number_desc`);
  await expect(list(page).getByRole('listitem').first()).toContainText('Routine inspection 51');
  await page.getByRole('link', { name: 'Next page', exact: true }).click();
  await expect(page).toHaveURL(/priority=low/);
  await expect(page).toHaveURL(/page=2/);
  await expect(list(page).getByRole('listitem')).toHaveCount(2);
  await expect(list(page).getByRole('listitem').last()).toContainText('Scuffed panel');
  await page.goto(
    `${path}?status=bogus&status=closed&priority=oops&assignee=bad&location=bad&category=bad&page=99999999999999999999&sort=bad`,
  );
  await expect(list(page).getByRole('listitem')).toHaveCount(50);
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('');
  await page.goto(`${path}?priority=critical&page=999`);
  await expect(list(page)).toContainText('Cracked fire door');
  await page.goto(`${path}?assignee=unassigned&mine=1`);
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText('Loose railing');
});

test('filters respect project RLS even with a forged shared URL', async ({ page }) => {
  await login(page, 'viewer');
  await page.goto(`${path}?q=door&assignee=${member}`);
  await expect(page.getByRole('heading', { name: 'Search test site' })).toHaveCount(0);
  await expect(page.getByText('Cracked fire door', { exact: true })).toHaveCount(0);
  // This viewer is intentionally not a member of the disposable project.
});

test('closed status, assigned-to-me and unavailable project options stay precise', async ({
  page,
}) => {
  await login(page);
  await page.goto(`${path}?status=closed`);
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText('Closed door');
  await page.goto(`${path}?assignee=me`);
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText('Ceiling inspection');
  await page.goto(`${path}?location=${crypto.randomUUID()}`);
  await expect(page.getByText('No snags match these filters.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Location', { exact: true })).toContainText('Unavailable location');
  await page.goto(`${path}?q=99999999999999999999`);
  await expect(page.getByText('No snags match these filters.', { exact: true })).toBeVisible();
});

test('phone filters reflow, keep labels and clear focused controls above navigation', async ({
  page,
}, testInfo) => {
  await login(page);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${path}?q=hinges`);
    await expect(page.getByLabel('Search snags', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`filters-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const apply = page.getByRole('button', { name: 'Apply filters', exact: true });
  await apply.focus();
  await apply.scrollIntoViewIfNeeded();
  const bounds = await apply.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Phone navigation' }).boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y);
});

test('finds rows beyond the global 1,000-row cap and keeps project statistics independent', async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (let offset = 0; offset < 1000; offset += 200) {
    await fixture(
      'snags',
      'POST',
      Array.from({ length: 200 }, (_, i) => ({
        project_id: project,
        title: `Large site check ${offset + i}`,
        created_by: member,
      })),
    );
  }
  await fixture('snags', 'POST', {
    project_id: project,
    title: 'Needle beyond response cap',
    description: 'Special ventilation survey',
    created_by: manager,
  });
  await login(page);
  await page.goto(`${path}?q=ventilation`);
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText('Needle beyond response cap');
  await expect(page.getByText('1058', { exact: true })).toBeVisible();
  await expect(page.getByText('1 result', { exact: true })).toBeVisible();
});
