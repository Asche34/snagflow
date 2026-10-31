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
  // Remove this project's objects, including uploads interrupted before metadata commit.
  if (!api || !serviceKey) throw new Error('Missing Storage fixture credentials');
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const list = async (prefix: string): Promise<{ name: string; id: string | null }[]> => {
    const response = await fetch(`${api}/storage/v1/object/list/snag-photos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
    if (!response.ok) throw new Error(`Storage fixture listing failed: ${response.status}`);
    return response.json();
  };
  const paths: string[] = [];
  for (const folder of await list(`${projectId}/`)) {
    for (const object of await list(`${projectId}/${folder.name}/`))
      paths.push(`${projectId}/${folder.name}/${object.name}`);
  }
  if (paths.length) {
    const removal = await fetch(`${api}/storage/v1/object/snag-photos`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!removal.ok) throw new Error(`Storage fixture cleanup failed: ${removal.status}`);
  }
  await fixture(`projects?id=eq.${projectId}`, 'DELETE');
});

test('member creates and edits a snag with project-local details', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('link', { name: 'New snag', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Loose outlet cover');
  await page.getByLabel('Description', { exact: true }).fill('Cover moves when touched.');
  // Next retains the project page hidden; use controls in the visible capture page.
  await page.getByRole('combobox', { name: 'Location', exact: true }).selectOption(locationId);
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption(categoryId);
  await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('high');
  await page.getByLabel('Due date', { exact: true }).filter({ visible: true }).fill('2026-12-15');
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
  await expect(page.getByRole('status').filter({ hasText: 'Snag saved' })).toContainText('Snag saved');
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
  await expect(page.getByRole('status').filter({ hasText: 'Assignment updated' })).toBeVisible();
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

async function photoFile(page: Page, name = 'inspection.png', width = 2400, height = 1200) {
  const data = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#c2410c';
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png').split(',')[1]!;
    },
    { width, height },
  );
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

test('member creates a snag with real resized issue photos and thumbnails', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Photo inspection');
  await page
    .getByLabel('Photo files', { exact: true })
    .setInputFiles([await photoFile(page), await photoFile(page, 'second.png', 1200, 2400)]);
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  const images = page.getByRole('img', { name: /Issue photo \d/ });
  await expect(images).toHaveCount(2);
  await expect(images.first()).toBeVisible();
  await expect
    .poll(() =>
      images
        .first()
        .evaluate(
          (image: HTMLImageElement) =>
            image.complete && image.naturalWidth === 400 && image.naturalHeight === 200,
        ),
    )
    .toBeTruthy();
  const snagId = page.url().split('/').pop();
  const response = await fixture(
    `snag_photos?snag_id=eq.${snagId}&select=width,height,kind,thumb_path&order=sort_order`,
  );
  const photos: { width: number; height: number; kind: string; thumb_path: string | null }[] =
    await response.json();
  expect(photos.map((photo) => [photo.width, photo.height, photo.kind])).toEqual([
    [1600, 800, 'issue'],
    [800, 1600, 'issue'],
  ]);
  expect(photos.every((photo) => !!photo.thumb_path)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('partial photo failure retries without duplicate snags or photo rows', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  const title = `Retry photo ${crypto.randomUUID()}`;
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page
    .getByLabel('Photo files', { exact: true })
    .setInputFiles([await photoFile(page), await photoFile(page, 'other.png')]);
  let writes = 0;
  let blockedPath = '';
  let allowRetry = false;
  await page.route('**/storage/v1/object/snag-photos/**', async (route) => {
    if (!['POST', 'PUT'].includes(route.request().method())) return route.continue();
    writes++;
    if (writes === 2) blockedPath = route.request().url();
    if (!allowRetry && route.request().url() === blockedPath)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 503,
          error: 'Unavailable',
          message: 'Test interrupted upload',
        }),
      });
    return route.continue();
  });
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toContainText('Snag saved');
  allowRetry = true;
  await page.getByRole('button', { name: 'Retry failed photos', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  await expect(page.getByRole('img', { name: /Issue photo \d/ })).toHaveCount(2);
  const response = await fixture(
    `snags?project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&select=id`,
  );
  const snags: { id: string }[] = await response.json();
  expect(snags).toHaveLength(1);
  expect(
    await (await fixture(`snag_photos?snag_id=eq.${snags[0]!.id}&select=id`)).json(),
  ).toHaveLength(2);
});

test('assignee uploads fix evidence and completes review workflow', async ({ page, browser }) => {
  const snagId = crypto.randomUUID();
  await fixture('snags', 'POST', {
    id: snagId,
    project_id: projectId,
    title: 'Fix evidence',
    created_by: ids.manager,
    assignee_id: ids.member1,
    status: 'in_progress',
  });
  await login(page, 'member1');
  await page.goto(`/snags/${snagId}`);
  await page.getByLabel('Photo kind', { exact: true }).selectOption('fix');
  await page.getByLabel('Photo files', { exact: true }).setInputFiles(await photoFile(page));
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Fix photo 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark ready for review', exact: true }).click();
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, 'manager');
  await managerPage.goto(`/snags/${snagId}`);
  await managerPage.getByRole('button', { name: 'Approve and close', exact: true }).click();
  await expect(managerPage.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
  expect(await (await fixture(`snags?id=eq.${snagId}&select=status`)).json()).toEqual([
    { status: 'closed' },
  ]);
  await managerContext.close();
});

test('photo selection rejects unsupported files and more than eight at phone width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  await expect(page.getByLabel('Photo files', { exact: true })).toBeEnabled();
  await page
    .getByLabel('Photo files', { exact: true })
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') });
  await expect(page.locator('form p[role="alert"]')).toContainText('JPEG, PNG or WebP');
  await page.getByLabel('Photo files', { exact: true }).setInputFiles({
    name: 'too-big.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
  });
  await expect(page.locator('form p[role="alert"]')).toContainText('20 MiB');
  const file = await photoFile(page);
  await page
    .getByLabel('Photo files', { exact: true })
    .setInputFiles(Array.from({ length: 9 }, (_, i) => ({ ...file, name: `photo-${i}.png` })));
  await expect(page.locator('form p[role="alert"]')).toContainText('8 photos');
  await page.getByLabel('Photo files', { exact: true }).setInputFiles([file]);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/capture-375-enlarged.png', fullPage: true });
});

test('server rejects a location from another visible project', async ({ page }) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  const title = `Invalid location ${crypto.randomUUID()}`;
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  const location = page.getByLabel('Location', { exact: true });
  await location.evaluate((select: HTMLSelectElement) =>
    select.add(new Option('Other project room', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01')),
  );
  await location.selectOption('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01');
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(page.locator('form div[role="alert"]')).toContainText('from this project');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
  expect(
    await (
      await fixture(
        `snags?project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&select=id`,
      )
    ).json(),
  ).toHaveLength(0);
});

test('membership lost after form load rejects save without losing typed details', async ({
  page,
}) => {
  await login(page, 'member2');
  await page.goto(`/projects/${projectId}/snags/new`);
  const title = `Access removed ${crypto.randomUUID()}`;
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await fixture(`project_members?project_id=eq.${projectId}&user_id=eq.${ids.member2}`, 'DELETE');
  try {
    await page.getByRole('button', { name: 'Save snag', exact: true }).click();
    await expect(page.locator('form div[role="alert"]')).toContainText('no longer have permission');
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
    expect(
      await (
        await fixture(
          `snags?project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&select=id`,
        )
      ).json(),
    ).toHaveLength(0);
  } finally {
    await fixture('project_members', 'POST', {
      project_id: projectId,
      user_id: ids.member2,
      role: 'member',
    });
  }
});

test('a lost metadata response retries an already committed photo exactly once', async ({
  page,
}) => {
  await login(page, 'member1');
  await page.goto(`/projects/${projectId}/snags/new`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Committed photo retry');
  await page.getByLabel('Photo files', { exact: true }).setInputFiles(await photoFile(page));
  let interrupted = false;
  await page.route('**/projects/**/snags/new', async (route) => {
    if (
      !interrupted &&
      route.request().method() === 'POST' &&
      route.request().postData()?.includes('thumbnailId')
    ) {
      interrupted = true;
      await route.fetch(); // Commit through the real action, then lose its response.
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Save snag', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry failed photos', exact: true }),
  ).toBeVisible();
  expect(interrupted).toBeTruthy();
  await page.getByRole('button', { name: 'Retry failed photos', exact: true }).click();
  await expect(page).toHaveURL(/\/snags\/[0-9a-f-]+$/);
  const snagId = page.url().split('/').pop();
  expect(await (await fixture(`snag_photos?snag_id=eq.${snagId}&select=id`)).json()).toHaveLength(
    1,
  );
  await expect(page.getByRole('img', { name: 'Issue photo 1', exact: true })).toBeVisible();
});

test('capture controls wait for hydration before accepting inspection data', async ({ page }) => {
  await login(page, 'member1');
  let release = () => {};
  const hydrationGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/static/chunks/**', async (route) => {
    if (route.request().resourceType() === 'script') await hydrationGate;
    return route.continue();
  });
  try {
    await page.goto(`/projects/${projectId}/snags/new`, { waitUntil: 'commit' });
    await expect(page.getByRole('button', { name: 'Save snag', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Photo files', { exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByLabel('Photo files', { exact: true })).toBeEnabled();
  await page
    .getByLabel('Photo files', { exact: true })
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') });
  await expect(page.locator('form p[role="alert"]')).toContainText('JPEG, PNG or WebP');
});

for (const actorName of ['member1', 'manager'] as const) {
  test(`${actorName} lost create response reconciles changed draft details on retry`, async ({
    page,
  }) => {
    await login(page, actorName);
    await page.goto(`/projects/${projectId}/snags/new`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Original draft title');
    if (actorName === 'manager')
      await page.getByLabel('Assignee', { exact: true }).selectOption(ids.member1);
    let interrupted = false;
    await page.route('**/projects/**/snags/new', async (route) => {
      if (
        !interrupted &&
        route.request().method() === 'POST' &&
        route.request().postData()?.includes('Original draft title')
      ) {
        interrupted = true;
        await route.fetch();
        return route.abort('failed');
      }
      return route.continue();
    });
    await page.getByRole('button', { name: 'Save snag', exact: true }).click();
    await expect(page.locator('form div[role="alert"]')).toBeVisible();
    const changed = `Changed after response loss ${crypto.randomUUID()}`;
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(changed);
    await page
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Retain this revision after retry');
    if (actorName === 'manager')
      await page.getByLabel('Assignee', { exact: true }).selectOption(ids.member2);
    await page.getByRole('button', { name: 'Save snag', exact: true }).click();
    await expect(page.getByRole('heading', { name: changed, exact: true })).toBeVisible();
    const snagId = page.url().split('/').pop();
    expect(await (await fixture(`snags?id=eq.${snagId}&select=title,description`)).json()).toEqual([
      { title: changed, description: 'Retain this revision after retry' },
    ]);
    expect(
      await (
        await fixture(
          `snags?project_id=eq.${projectId}&title=eq.Original%20draft%20title&select=id`,
        )
      ).json(),
    ).toHaveLength(0);
    if (actorName === 'manager')
      expect(await (await fixture(`snags?id=eq.${snagId}&select=assignee_id`)).json()).toEqual([
        { assignee_id: ids.member2 },
      ]);
  });
}

test('edit loads its target directly beyond the workspace query limit', async ({ page }) => {
  await fixture(
    'snags',
    'POST',
    Array.from({ length: 1001 }, (_, i) => ({
      project_id: projectId,
      title: `Pagination fixture ${i}`,
      created_by: ids.member1,
    })),
  );
  const snagId = crypto.randomUUID();
  await fixture('snags', 'POST', {
    id: snagId,
    project_id: projectId,
    title: 'Beyond first page',
    created_by: ids.member1,
  });
  await login(page, 'member1');
  await page.goto(`/snags/${snagId}`);
  await page.getByRole('link', { name: 'Edit snag', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Beyond first page',
  );
});
