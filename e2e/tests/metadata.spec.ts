import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

const settings: Record<string, string | undefined> = { ...process.env };
if (existsSync('../supabase/tests/test.env')) {
  for (const line of readFileSync('../supabase/tests/test.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
    if (match && !settings[match[1]!]) settings[match[1]!] = match[2]!;
  }
}
const project = crypto.randomUUID();
const location = crypto.randomUUID();
const category = crypto.randomUUID();
const snag = crypto.randomUUID();
const admin = '11111111-1111-4111-8111-111111111111';
const manager = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
async function fixture(resource: string, method = 'GET', body?: unknown) {
  const key = settings['SUPABASE_SERVICE_ROLE_KEY']!;
  const response = await fetch(`${settings['SUPABASE_URL']}/rest/v1/${resource}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Metadata fixture ${method} failed: ${response.status}`);
  return response.json();
}
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test.beforeAll(async () => {
  await fixture('projects', 'POST', {
    id: project,
    name: 'Metadata browser site',
    code: `M${Date.now().toString(36)}`,
    created_by: admin,
  });
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: member, role: 'member' },
  ]);
  await fixture('locations', 'POST', { id: location, project_id: project, name: 'Historic room' });
  await fixture('categories', 'POST', {
    id: category,
    project_id: project,
    name: 'Historic trade',
  });
  await fixture('snags', 'POST', {
    id: snag,
    client_id: snag,
    project_id: project,
    title: 'Metadata browser defect',
    created_by: member,
    location_id: location,
    category_id: category,
  });
});
test.afterAll(async () => {
  await fixture(`projects?id=eq.${project}`, 'DELETE');
});

test('manager manages hierarchy and categories, confirms safe removal and refreshes selectors', async ({
  page,
}, testInfo) => {
  await login(page, 'manager');
  await page.goto(`/projects/${project}?tab=locations`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('metadata-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Add location', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('New room');
  await dialog.getByLabel('Parent location').selectOption(location);
  await dialog.getByLabel('Order').fill('2');
  await dialog.getByRole('button', { name: 'Save location' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit location New room', exact: true }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('Renamed room');
  await dialog.getByLabel('Parent location').selectOption('');
  await dialog.getByRole('button', { name: 'Save location' }).click();
  await expect(dialog).toHaveCount(0);
  const rows = await fixture(`locations?project_id=eq.${project}&name=eq.Renamed%20room`);
  expect(rows).toHaveLength(1);
  expect(rows[0].parent_id).toBeNull();
  expect(rows[0].sort_order).toBe(2);
  await page.getByRole('button', { name: 'Delete location Historic room', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete location Historic room', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(dialog.getByRole('alert')).toBeFocused();
  await expect(dialog.getByRole('alert')).toContainText(/historical/);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete location Renamed room', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Edit location Renamed room', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit category Historic trade', exact: true }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('Renamed trade');
  await dialog.getByRole('button', { name: 'Save category' }).click();
  await expect(dialog).toHaveCount(0);
  expect((await fixture(`snags?id=eq.${snag}`))[0].category_id).toBe(category);
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('Renamed trade');
  await dialog.getByRole('button', { name: 'Save category' }).click();
  await expect(dialog.getByRole('alert')).toContainText('already in use');
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Renamed trade');
  await dialog.getByLabel('Name', { exact: true }).fill('Unused trade');
  await dialog.getByRole('button', { name: 'Save category' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete category Unused trade', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`/projects/${project}`);
  await expect(
    page
      .getByLabel('Category', { exact: true })
      .locator('option')
      .filter({ hasText: 'Renamed trade' }),
  ).toHaveCount(1);
});

test('member has read-only metadata; stale manager save keeps draft and denies commit', async ({
  page,
}) => {
  await login(page, 'member1');
  await page.goto(`/projects/${project}?tab=locations`);
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText('Historic room');
  await login(page, 'manager');
  await page.goto(`/projects/${project}?tab=locations`);
  await page.getByRole('button', { name: 'Add location', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Denied draft');
  await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
    role: 'viewer',
  });
  try {
    await dialog.getByRole('button', { name: 'Save location' }).click();
    await expect(dialog.getByRole('alert')).toBeFocused();
    await expect(dialog.getByRole('alert')).toContainText('permission');
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Denied draft');
    expect(await fixture(`locations?project_id=eq.${project}&name=eq.Denied%20draft`)).toHaveLength(
      0,
    );
  } finally {
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
      role: 'manager',
    });
  }
});

test('comment drafts survive transport errors; response-loss retry posts once and refreshes thread', async ({
  page,
}, testInfo) => {
  await login(page, 'member1');
  await page.goto(`/snags/${snag}`);
  const thread = page.getByRole('region', { name: 'Comments' });
  await expect(thread.getByLabel('Add a comment')).toBeVisible();
  const body = `First line\n${'unbroken'.repeat(50)}`;
  await thread.getByLabel('Add a comment').fill(body);
  await page.route(`**/snags/${snag}`, async (route) => {
    if (route.request().method() === 'POST') await route.abort();
    else await route.continue();
  });
  await thread.getByRole('button', { name: 'Post comment' }).click();
  await expect(thread.getByRole('alert')).toBeFocused();
  await expect(thread.getByLabel('Add a comment')).toHaveValue(body);
  await page.unroute(`**/snags/${snag}`);
  let lost = false;
  await page.route(`**/snags/${snag}`, async (route) => {
    if (route.request().method() === 'POST' && !lost) {
      lost = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await thread.getByRole('button', { name: 'Post comment' }).click();
  await expect(thread.getByRole('alert')).toBeVisible();
  await page.unroute(`**/snags/${snag}`);
  await thread.getByRole('button', { name: 'Post comment' }).click();
  await expect(thread.getByRole('status')).toContainText('Comment posted');
  await expect(thread.getByLabel('Add a comment')).toHaveValue('');
  await expect(thread.getByLabel('Add a comment')).toBeFocused();
  expect(await fixture(`comments?snag_id=eq.${snag}`)).toHaveLength(1);
  await page.setViewportSize({ width: 375, height: 850 });
  await page.addStyleTag({ content: 'html { font-size: 24px; }' });
  await expect(thread).toContainText('First line');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('comments-phone.png'), fullPage: true });
  await login(page, 'manager');
  await page.goto(`/snags/${snag}`);
  await expect(page.getByRole('region', { name: 'Comments' })).toContainText('First line');
});

test('metadata controls reflow on enlarged phone and landscape; canceled deletion retains record', async ({
  page,
}, testInfo) => {
  await login(page, 'manager');
  await page.setViewportSize({ width: 375, height: 850 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/projects/${project}?tab=locations`);
  await page.addStyleTag({ content: 'html { font-size: 24px; }' });
  await page.getByRole('button', { name: 'Edit location Historic room', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Name', { exact: true })).toHaveValue(
    'Historic room',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('location-phone.png'), fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 850, height: 375 });
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Save category' }),
  ).toBeInViewport();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await fixture(`locations?id=eq.${location}`))[0].name).toBe('Historic room');
});

test('changed comment after lost response is retained; blank and viewer/revoked posts are denied', async ({
  page,
}) => {
  await login(page, 'member1');
  await page.goto(`/snags/${snag}`);
  const thread = page.getByRole('region', { name: 'Comments' });
  await thread.getByLabel('Add a comment').fill('   ');
  await expect(thread.getByRole('button', { name: 'Post comment' })).toBeDisabled();
  const posted = `Original ${Date.now()}`;
  await thread.getByLabel('Add a comment').fill(posted);
  await page.route(`**/snags/${snag}`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await thread.getByRole('button', { name: 'Post comment' }).click();
  await expect(thread.getByRole('alert')).toBeVisible();
  await page.unroute(`**/snags/${snag}`);
  await thread.getByLabel('Add a comment').fill('Changed draft must survive');
  await thread.getByRole('button', { name: 'Post comment' }).click();
  await expect(thread.getByRole('alert')).toContainText('earlier draft');
  await expect(thread.getByLabel('Add a comment')).toHaveValue('Changed draft must survive');
  expect(
    (await fixture(`comments?snag_id=eq.${snag}`)).filter(
      (row: { body: string }) => row.body === posted,
    ),
  ).toHaveLength(1);
  await page.reload();
  await thread.getByLabel('Add a comment').fill('Revoked post');
  await fixture(`project_members?project_id=eq.${project}&user_id=eq.${member}`, 'PATCH', {
    role: 'viewer',
  });
  try {
    await thread.getByRole('button', { name: 'Post comment' }).click();
    await expect(thread.getByRole('alert')).toContainText('access');
    await expect(thread.getByLabel('Add a comment')).toHaveValue('Revoked post');
    await page.reload();
    await expect(thread.getByLabel('Add a comment')).toHaveCount(0);
    await expect(thread).toContainText(posted);
  } finally {
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${member}`, 'PATCH', {
      role: 'member',
    });
  }
});

test('metadata remains complete beyond 1,000 rows in manager lists and capture selectors', async ({
  page,
}) => {
  const ids = Array.from({ length: 1002 }, () => crypto.randomUUID());
  await fixture(
    'locations',
    'POST',
    ids.map((id, index) => ({
      id,
      project_id: project,
      name: `Bulk room ${index}`,
      sort_order: index,
    })),
  );
  try {
    await login(page, 'manager');
    await page.goto(`/projects/${project}?tab=locations`);
    await expect(page.getByRole('button', { name: /^Edit location / })).toHaveCount(1003);
    await page.goto(`/projects/${project}/snags/new`);
    await expect(page.getByLabel('Location', { exact: true }).locator('option')).toHaveCount(1004);
  } finally {
    for (let offset = 0; offset < ids.length; offset += 100)
      await fixture(`locations?id=in.(${ids.slice(offset, offset + 100).join(',')})`, 'DELETE');
  }
});

test('thread includes newest comments beyond the backend 1,000-row response cap', async ({
  page,
}) => {
  const ids = Array.from({ length: 1001 }, () => crypto.randomUUID());
  await fixture(
    'comments',
    'POST',
    ids.map((id, index) => ({
      id,
      snag_id: snag,
      author_id: member,
      body: `History comment ${index}`,
      created_at: new Date(Date.now() + index * 1000).toISOString(),
    })),
  );
  try {
    await login(page, 'manager');
    await page.goto(`/snags/${snag}`);
    await expect(
      page
        .getByRole('region', { name: 'Comments' })
        .getByText('History comment 1000', { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Comments' })
        .getByText('History comment 0', { exact: true }),
    ).toBeVisible();
  } finally {
    for (let offset = 0; offset < ids.length; offset += 100)
      await fixture(`comments?id=in.(${ids.slice(offset, offset + 100).join(',')})`, 'DELETE');
  }
});

test('member and manager collaborate through separate browser sessions with refreshed threads', async ({
  page,
  browser,
}) => {
  const secondContext = await browser.newContext();
  const managerPage = await secondContext.newPage();
  try {
    await login(page, 'member1');
    await login(managerPage, 'manager');
    await page.goto(`/snags/${snag}`);
    await managerPage.goto(`/snags/${snag}`);
    const memberThread = page.getByRole('region', { name: 'Comments' });
    const managerThread = managerPage.getByRole('region', { name: 'Comments' });
    await memberThread.getByLabel('Add a comment').fill('Member inspection complete');
    await memberThread.getByRole('button', { name: 'Post comment' }).click();
    await expect(memberThread.getByRole('status')).toContainText('Comment posted');
    await managerPage.reload();
    await expect(managerThread).toContainText('Member inspection complete');
    await managerThread.getByLabel('Add a comment').fill('Manager inspection acknowledged');
    await managerThread.getByRole('button', { name: 'Post comment' }).click();
    await expect(managerThread.getByRole('status')).toContainText('Comment posted');
    await page.reload();
    await expect(memberThread).toContainText('Manager inspection acknowledged');
  } finally {
    await secondContext.close();
  }
});

test('lost metadata responses reconcile exact creates and preserve changed drafts for review', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto(`/projects/${project}?tab=locations`);
  const dialog = page.getByRole('dialog');
  const pattern = `**/projects/${project}?*`;
  for (const kind of ['category', 'location'] as const) {
    await page.getByRole('button', { name: `Add ${kind}`, exact: true }).click();
    const name = `Retry ${kind}`;
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await page.route(pattern, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await dialog.getByRole('button', { name: `Save ${kind}` }).click();
    await expect(dialog.getByRole('alert')).toBeFocused();
    await page.unroute(pattern);
    if (kind === 'location')
      await dialog.getByLabel('Name', { exact: true }).fill('Revised location draft');
    await dialog.getByRole('button', { name: `Save ${kind}` }).click();
    if (kind === 'category') await expect(dialog).toHaveCount(0);
    else {
      await expect(dialog.getByRole('alert')).toContainText('earlier draft was saved');
      await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue(
        'Revised location draft',
      );
      await dialog.getByRole('link', { name: 'Refresh list' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Edit location Retry location', exact: true }),
      ).toBeVisible();
    }
    expect(
      await fixture(
        `${kind === 'location' ? 'locations' : 'categories'}?project_id=eq.${project}&name=eq.${encodeURIComponent(name)}`,
      ),
    ).toHaveLength(1);
  }
});
