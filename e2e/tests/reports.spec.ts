import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ExcelJS = require('exceljs') as typeof import('../../apps/web/node_modules/exceljs');
test.setTimeout(240000);
const settings: Record<string, string | undefined> = { ...process.env };
for (const line of readFileSync('../supabase/tests/test.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
  if (match && !settings[match[1]!]) settings[match[1]!] = match[2]!;
}
const project = crypto.randomUUID();
const largeProject = crypto.randomUUID();
const admin = '11111111-1111-4111-8111-111111111111';
const manager = '22222222-2222-4222-8222-222222222222';
const viewer = '55555555-5555-4555-8555-555555555555';
const paths: string[] = [];
let jpeg: Buffer;
let adminToken = '';
let managerToken = '';
let viewerToken = '';
let firstSnag = '';
const options = {
  cover: true,
  photos: true,
  annotated: true,
  photoSize: 'medium',
  comments: true,
  timestamps: true,
  fixPhotos: true,
  groupBy: 'location',
  sortBy: 'number',
};
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
  if (!response.ok)
    throw new Error(
      `Report fixture ${method} ${resource} failed: ${response.status} ${await response.text()}`,
    );
  return response.json();
}
async function token(role: string) {
  const response = await fetch(`${settings['SUPABASE_URL']}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: settings['SUPABASE_ANON_KEY']!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${role}@snagflow.test`, password: 'Password123!' }),
  });
  if (!response.ok) throw new Error('Report fixture authentication failed');
  return (await response.json()).access_token as string;
}
async function upload(path: string, bytes: Buffer, type = 'image/jpeg', bucket = 'snag-photos') {
  const key = settings['SUPABASE_SERVICE_ROLE_KEY']!;
  const result = await fetch(`${settings['SUPABASE_URL']}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': type },
    body: new Uint8Array(bytes),
  });
  if (!result.ok) throw new Error(`Report fixture photo upload failed ${result.status}`);
  if (bucket === 'snag-photos') paths.push(path);
}
async function login(page: Page, role = 'manager') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function generate(
  request: APIRequestContext,
  input: Record<string, unknown>,
  access = adminToken,
) {
  const response = await request.post('/api/reports', {
    headers: { Authorization: `Bearer ${access}` },
    data: {
      requestId: crypto.randomUUID(),
      projectId: project,
      format: 'pdf',
      theme: 'classic',
      filters: {},
      options,
      ...input,
    },
    timeout: 220000,
  });
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(200);
  return body;
}
test.beforeAll(async ({ browser }) => {
  [adminToken, managerToken, viewerToken] = await Promise.all([
    token('admin'),
    token('manager'),
    token('viewer'),
  ]);
  const context = await browser.newContext();
  const page = await context.newPage();
  jpeg = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#d9e6e8';
      ctx.fillRect(0, 0, 800, 450);
      ctx.fillStyle = '#295c69';
      ctx.fillRect(160, 100, 420, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '32px sans-serif';
      ctx.fillText('Report inspection photo', 200, 230);
      return canvas.toDataURL('image/jpeg').split(',')[1]!;
    }),
    'base64',
  );
  await context.close();
  await fixture('projects', 'POST', [
    {
      id: project,
      name: 'Report acceptance site',
      code: `RP${Date.now().toString(36)}`,
      created_by: admin,
    },
    {
      id: largeProject,
      name: 'Report pagination site',
      code: `RL${Date.now().toString(36)}`,
      created_by: admin,
    },
  ]);
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: viewer, role: 'viewer' },
    { project_id: largeProject, user_id: manager, role: 'manager' },
  ]);
  const snags = Array.from({ length: 100 }, (_, index) => {
    const id = crypto.randomUUID();
    return {
      id,
      client_id: id,
      project_id: project,
      title: `Inspection item ${String(index + 1).padStart(3, '0')}`,
      description: 'Verified export description',
      created_by: manager,
      priority: index % 2 ? 'high' : 'low',
    };
  });
  await fixture('snags', 'POST', snags);
  firstSnag = snags[0]!.id;
  // Four concurrent uploads bound fixture I/O just like the production image reader.
  const photos: Record<string, unknown>[] = [];
  for (let offset = 0; offset < snags.length; offset += 4)
    await Promise.all(
      snags.slice(offset, offset + 4).map(async (snag, index) => {
        const id = crypto.randomUUID();
        const path = `${project}/${snag.id}/${id}.jpg`;
        await upload(path, jpeg);
        photos.push({
          id,
          snag_id: snag.id,
          storage_path: path,
          width: 800,
          height: 450,
          uploaded_by: manager,
          kind: 'issue',
          sort_order: 0,
        });
        if (offset === 0 && index === 0) {
          const fix = crypto.randomUUID();
          const fixPath = `${project}/${snag.id}/${fix}.jpg`;
          await upload(fixPath, jpeg);
          photos.push({
            id: fix,
            snag_id: snag.id,
            storage_path: fixPath,
            width: 800,
            height: 450,
            uploaded_by: manager,
            kind: 'fix',
            sort_order: 1,
          });
        }
      }),
    );
  await fixture('snag_photos', 'POST', photos);
  await fixture('comments', 'POST', {
    snag_id: snags[0]!.id,
    author_id: manager,
    body: 'Exported inspection comment',
  });
  // Cross the backend 1,000-row cap without touching seeded project rows.
  for (let offset = 0; offset < 1005; offset += 200)
    await fixture(
      'snags',
      'POST',
      Array.from({ length: Math.min(200, 1005 - offset) }, (_, i) => {
        const id = crypto.randomUUID();
        return {
          id,
          client_id: id,
          project_id: largeProject,
          title: `Pagination item ${offset + i + 1}`,
          created_by: manager,
        };
      }),
    );
});
test.afterAll(async () => {
  const reports = await fixture(
    `reports?project_id=in.(${project},${largeProject})&select=storage_path`,
  );
  const key = settings['SUPABASE_SERVICE_ROLE_KEY']!;
  for (const [bucket, prefixes] of [
    ['snag-photos', paths],
    ['reports', reports.map((row: { storage_path: string }) => row.storage_path)],
  ] as const) {
    if (prefixes.length) {
      const result = await fetch(`${settings['SUPABASE_URL']}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes }),
      });
      if (!result.ok) throw new Error(`Report fixture cleanup failed ${result.status}`);
    }
  }
  await fixture(`projects?id=in.(${project},${largeProject})`, 'DELETE');
});
test('100 photo snags export all three PDF themes, Excel fields, and immutable retry revisions', async ({
  request,
}) => {
  mkdirSync('.playwright/phase4-reports-artifacts', { recursive: true });
  const revisions: number[] = [];
  for (const theme of ['classic', 'compact', 'photo_first']) {
    const started = Date.now();
    const result = await generate(request, { theme });
    revisions.push(result.report.revision);
    const downloaded = await request.get(result.url);
    expect(downloaded.ok()).toBe(true);
    const bytes = await downloaded.body();
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(20000);
    expect(Date.now() - started).toBeLessThan(220000);
    writeFileSync(`.playwright/phase4-reports-artifacts/${theme}.pdf`, bytes);
    const anonymous = await fetch(
      `${settings['SUPABASE_URL']}/storage/v1/object/reports/${result.report.storage_path}`,
      { headers: { apikey: settings['SUPABASE_ANON_KEY']! } },
    );
    expect(anonymous.ok).toBe(false);
  }
  expect(revisions).toEqual([1, 2, 3]);
  const longComments = Array.from({ length: 7 }, (_, index) => ({
    snag_id: firstSnag,
    author_id: manager,
    body: `Long comment ${index + 1}: `.padEnd(5000, 'x'),
  }));
  await fixture('comments', 'POST', longComments);
  const requestId = crypto.randomUUID();
  const result = await generate(request, { requestId, format: 'xlsx' });
  const repeat = await generate(request, { requestId, format: 'xlsx' });
  expect(repeat.report.id).toBe(result.report.id);
  expect(repeat.report.revision).toBe(4);
  const bytes = await (await request.get(result.url)).body();
  writeFileSync('.playwright/phase4-reports-artifacts/report.xlsx', bytes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const items = workbook.getWorksheet('Items')!;
  expect(items.rowCount).toBe(101);
  expect(workbook.getWorksheet('Photos')!.rowCount).toBe(102);
  expect(workbook.getWorksheet('Summary')!.getCell('B8').value).toBe(100);
  const header = items.getRow(1).values as string[];
  const titleIndex = header.indexOf('title');
  expect(
    Array.from({ length: 100 }, (_, index) => items.getRow(index + 2).getCell(titleIndex).text),
  ).toContain('Inspection item 100');
  const linkIndex = header.indexOf('link');
  expect(items.getRow(2).getCell(linkIndex).value).toMatchObject({
    hyperlink: expect.stringMatching(/\/snags\/[a-f0-9-]+$/),
  });
  const comments = workbook.getWorksheet('Comments')!;
  expect(comments.rowCount).toBe(9);
  const bodyColumn = (comments.getRow(1).values as string[]).indexOf('Comment');
  for (const comment of longComments)
    expect(comments.getColumn(bodyColumn).values).toContain(comment.body);
  expect(comments.getColumn(bodyColumn).values).toContain('Exported inspection comment');
  for (const worksheet of workbook.worksheets)
    worksheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') expect(cell.value.length).toBeLessThanOrEqual(32767);
      }),
    );
});
test('report reads exceed 1,000 rows and combine priority filters without partial exports', async ({
  request,
}) => {
  const result = await generate(
    request,
    {
      projectId: largeProject,
      format: 'xlsx',
      options: { ...options, photos: false, comments: false },
    },
    managerToken,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await (await request.get(result.url)).body());
  expect(workbook.getWorksheet('Items')!.rowCount).toBe(1006);
  const filtered = await generate(
    request,
    { format: 'xlsx', filters: { priorities: ['high'] }, options: { ...options, photos: false } },
    managerToken,
  );
  const filteredBook = new ExcelJS.Workbook();
  await filteredBook.xlsx.load(await (await request.get(filtered.url)).body());
  expect(filteredBook.getWorksheet('Items')!.rowCount).toBe(51);
});
test('browser retains failed drafts, generates, downloads and regenerates saved options on phone layout', async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/projects/${project}?tab=reports`);
  await expect(page.getByRole('heading', { name: 'Generate a report', exact: true })).toBeVisible();
  await page.getByLabel('Theme', { exact: true }).selectOption('compact');
  await page.getByLabel('Include photos', { exact: true }).uncheck();
  await page.getByLabel('Include comments', { exact: true }).check();
  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporary report interruption' }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Generate report', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Temporary report interruption' }),
  ).toBeFocused();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('compact');
  await expect(page.getByLabel('Include photos', { exact: true })).not.toBeChecked();
  await page.unroute('**/api/reports');
  await page.getByRole('button', { name: 'Generate report', exact: true }).click();
  const download = page.getByRole('link', { name: /Download revision.*PDF/ });
  await expect(download).toBeVisible({ timeout: 30000 });
  const label = (await download.textContent())!;
  const revision = Number(label.match(/revision (\d+)/)![1]);
  await page.getByRole('button', { name: `Regenerate revision ${revision}`, exact: true }).click();
  await expect(
    page.getByRole('link', { name: `Download revision ${revision + 1} (PDF)`, exact: true }),
  ).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: '.playwright/phase4-reports-artifacts/reports-phone.png',
    fullPage: true,
  });
});
test('viewer, anonymous, invalid dates and cross-origin cookie writes are rejected', async ({
  request,
  page,
}) => {
  const body = { requestId: crypto.randomUUID(), projectId: project, format: 'pdf' };
  expect(
    (
      await request.post('/api/reports', {
        data: body,
        headers: { Authorization: `Bearer ${viewerToken}` },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get(`/api/reports?projectId=${project}`)).status()).toBe(401);
  expect(
    (
      await request.post('/api/reports', {
        data: { ...body, filters: { createdFrom: '2026-02-30' } },
        headers: { Authorization: `Bearer ${managerToken}` },
      })
    ).status(),
  ).toBe(400);
  await login(page);
  const denied = await page.request.post('/api/reports', {
    data: body,
    headers: { Origin: 'https://untrusted.invalid' },
  });
  expect(denied.status()).toBe(403);
});

test('history pagination retains a report draft and exposes older revisions', async ({
  page,
  request,
}) => {
  const previous = await fixture(
    `reports?project_id=eq.${project}&select=revision&order=revision.desc&limit=1`,
  );
  const start = previous[0]?.revision ?? 0;
  await fixture(
    'reports',
    'POST',
    Array.from({ length: 21 }, (_, index) => {
      const id = crypto.randomUUID();
      return {
        id,
        project_id: project,
        revision: start + index + 1,
        format: 'pdf',
        theme: 'classic',
        filters: {},
        options,
        storage_path: `${project}/${id}.pdf`,
        created_by: manager,
      };
    }),
  );
  const response = await request.get(`/api/reports?projectId=${project}&page=2`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.reports.length).toBeGreaterThan(0);
  expect(result.reports.length).toBeLessThanOrEqual(20);
  await login(page);
  await page.goto(`/projects/${project}?tab=reports`);
  await page.getByLabel('Theme', { exact: true }).selectOption('photo_first');
  await page.getByRole('button', { name: 'Next reports', exact: true }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('photo_first');
  await page.getByRole('button', { name: 'Previous reports', exact: true }).click();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
});
