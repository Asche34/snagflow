import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.setTimeout(60_000);
const settings: Record<string, string | undefined> = { ...process.env };
for (const line of readFileSync('../supabase/tests/test.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
  if (match && !settings[match[1]!]) settings[match[1]!] = match[2]!;
}
const project = crypto.randomUUID();
const admin = '11111111-1111-4111-8111-111111111111';
const manager = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const viewer = '55555555-5555-4555-8555-555555555555';
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
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Phase 3 fixture ${method} failed: ${response.status} ${error.code ?? ''} ${error.message ?? ''}`,
    );
  }
  return response.json();
}
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function createSnag(title: string) {
  const id = crypto.randomUUID();
  await fixture('snags', 'POST', {
    id,
    client_id: id,
    project_id: project,
    title,
    created_by: member,
  });
  return id;
}
async function managerRpc(name: string, body: unknown) {
  const auth = await fetch(`${settings['SUPABASE_URL']}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: settings['SUPABASE_ANON_KEY']!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@snagflow.test', password: 'Password123!' }),
  });
  if (!auth.ok) throw new Error('Fixture manager authentication failed');
  const session = await auth.json();
  const response = await fetch(`${settings['SUPABASE_URL']}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: settings['SUPABASE_ANON_KEY']!,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Fixture manager ${name} failed: ${response.status}`);
}
test.beforeAll(async () => {
  await fixture('projects', 'POST', {
    id: project,
    name: 'Live collaboration site',
    code: `R${Date.now().toString(36)}`,
    created_by: admin,
    require_fix_photo: false,
  });
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: member, role: 'member' },
    { project_id: project, user_id: viewer, role: 'viewer' },
  ]);
});
test.afterAll(async () => {
  await fixture(`projects?id=eq.${project}`, 'DELETE');
});

test('live comments preserve a draft and catch up after offline reconnect', async ({
  page,
  browser,
}) => {
  let commentEvents = 0;
  page.on('websocket', (socket) =>
    socket.on('framereceived', (frame) => {
      const raw = JSON.parse(String(frame.payload));
      const data = Array.isArray(raw) ? { event: raw[3], payload: raw[4] } : raw;
      if (data.event === 'postgres_changes' && data.payload?.data?.table === 'comments')
        commentEvents++;
    }),
  );
  const id = await createSnag('Realtime comment defect');
  await login(page, 'manager');
  await page.goto(`/snags/${id}`);
  await expect(page.getByText('Live updates connected', { exact: true })).toBeVisible();
  await page.getByLabel('Add a comment', { exact: true }).fill('Manager unfinished draft');
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await login(other, 'member1');
    await other.goto(`/snags/${id}`);
    await other.getByLabel('Add a comment', { exact: true }).fill('Live member comment');
    await other.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(other.getByText('Comment posted.', { exact: true })).toBeVisible();
    await page.bringToFront();
    await expect(page.getByText('Live member comment', { exact: true })).toBeVisible();
    expect(commentEvents).toBeGreaterThan(0);
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue(
      'Manager unfinished draft',
    );
    await page.context().setOffline(true);
    await expect(
      page.getByText('Offline · updates will resume when connected').first(),
    ).toBeVisible();
    await other.getByLabel('Add a comment', { exact: true }).fill('Comment during disconnect');
    await other.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(other.getByText('Comment posted.', { exact: true })).toBeVisible();
    await page.bringToFront();
    await page.context().setOffline(false);
    await expect(page.getByText('Comment during disconnect', { exact: true })).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText('Offline · updates will resume when connected')).toHaveCount(0);
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue(
      'Manager unfinished draft',
    );
  } finally {
    await context.close();
  }
});

test('project list and detail update on remote edits, photo changes and deletion', async ({
  page,
}) => {
  const id = await createSnag('Remote edit before');
  await login(page, 'manager');
  await page.goto(`/projects/${project}`);
  await expect(page.getByText('Live updates connected', { exact: true })).toBeVisible();
  await fixture(`snags?id=eq.${id}`, 'PATCH', { title: 'Remote edit after' });
  await expect(page.getByRole('link', { name: /Remote edit after/ })).toBeVisible();
  await page.goto(`/snags/${id}`);
  await expect(page.getByText('Live updates connected', { exact: true })).toBeVisible();
  const photo = crypto.randomUUID();
  await fixture('snag_photos', 'POST', {
    id: photo,
    snag_id: id,
    storage_path: `${project}/${id}/${photo}.jpg`,
    width: 100,
    height: 100,
    uploaded_by: member,
  });
  await expect(page.getByRole('heading', { name: 'Issue photos', exact: true })).toBeVisible();
  await fixture(`snag_photos?id=eq.${photo}`, 'DELETE');
  await expect(page.getByRole('heading', { name: 'Issue photos', exact: true })).toHaveCount(0, {
    timeout: 20_000,
  });
  await fixture(`snags?id=eq.${id}`, 'DELETE');
  await expect(page.getByRole('heading', { name: 'Remote edit after' })).toHaveCount(0, {
    timeout: 20_000,
  });
});

test('bell receives private notifications live, marks one/all read and fits a phone', async ({
  page,
}, info) => {
  const id = await createSnag('Notification destination');
  await login(page, 'member1');
  const bell = page.getByRole('button', { name: /Notifications/ });
  await expect(bell).toBeVisible();
  await expect(bell).toHaveAccessibleName(/Notifications, \d+ unread/);
  const initial = Number((await bell.getAttribute('aria-label'))!.match(/\d+/)![0]);
  const notification = crypto.randomUUID();
  await fixture('notifications', 'POST', {
    id: notification,
    user_id: member,
    project_id: project,
    snag_id: id,
    type: 'assigned',
    payload: { snippet: 'Personal phase three notice' },
  });
  await expect(bell).toHaveAccessibleName(`Notifications, ${initial + 1} unread`);
  await bell.click();
  const dialog = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(dialog.getByText('Personal phase three notice')).toBeVisible();
  await fixture('notifications', 'POST', {
    user_id: manager,
    project_id: project,
    snag_id: id,
    type: 'assigned',
    payload: { snippet: 'Private manager only notice' },
  });
  await expect(dialog.getByText('Private manager only notice')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Mark read', exact: true }).first().click();
  await expect
    .poll(async () => (await fixture(`notifications?id=eq.${notification}`))[0].read_at)
    .not.toBeNull();
  await dialog.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(dialog.getByText('0 unread · Latest 30 updates', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: info.outputPath('notifications-phone.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(bell).toHaveAccessibleName('Notifications, 0 unread');
  await expect(bell).toBeFocused();
});

test('remote assignment refreshes an untouched selector and preserves a deliberate draft', async ({
  page,
  browser,
}) => {
  const id = await createSnag('Concurrent manager assignment');
  await login(page, 'manager');
  await page.goto(`/snags/${id}`);
  await expect(page.getByText('Live updates connected', { exact: true })).toBeVisible();
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await login(other, 'manager');
    await other.goto(`/snags/${id}`);
    await other.getByLabel('Assign to', { exact: true }).selectOption(member);
    await other.getByRole('button', { name: 'Update assignment' }).click();
    await expect(other.getByText('Assignment updated.', { exact: true })).toBeVisible();
    await page.bringToFront();
    await expect(page.getByLabel('Assign to', { exact: true })).toHaveValue(member);
    await page.getByLabel('Assign to', { exact: true }).selectOption('');
    await other.getByLabel('Assign to', { exact: true }).selectOption(manager);
    await other.getByRole('button', { name: 'Update assignment' }).click();
    await expect
      .poll(async () => (await fixture(`snags?id=eq.${id}`))[0].assignee_id)
      .toBe(manager);
    await page.bringToFront();
    await expect(page.getByLabel('Assign to', { exact: true })).toHaveValue('');
  } finally {
    await context.close();
  }
});

test('notification failures are explicit and recovered reads clear their alert', async ({
  page,
}) => {
  await login(page, 'member1');
  await page.route('**/rest/v1/notifications**', (route) => route.abort());
  await page.getByRole('button', { name: /Notifications/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('could not be refreshed');
  await page.unroute('**/rest/v1/notifications**');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await fixture('notifications', 'POST', {
    user_id: member,
    project_id: project,
    type: 'assigned',
    payload: { snippet: 'Write failure notification' },
  });
  await expect(dialog.getByText('Write failure notification')).toBeVisible();
  await page.route('**/rest/v1/notifications**', (route) =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  );
  await dialog.getByRole('button', { name: 'Mark read', exact: true }).first().click();
  await expect(dialog.getByRole('alert')).toContainText('Read status could not be saved');
  await expect(
    dialog.getByRole('button', { name: 'Mark read', exact: true }).first(),
  ).toBeEnabled();
  await page.unroute('**/rest/v1/notifications**');
  await dialog.getByRole('button', { name: 'Mark read', exact: true }).first().click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('open detail reconciles removed membership and remote soft deletion', async ({ page }) => {
  const id = await createSnag('Access reconciliation defect');
  await login(page, 'viewer');
  await page.goto(`/snags/${id}`);
  await expect(page.getByText('Live updates connected', { exact: true })).toBeVisible();
  try {
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${viewer}`, 'DELETE');
    await expect(page.getByRole('heading', { name: 'Access reconciliation defect' })).toHaveCount(
      0,
      { timeout: 20_000 },
    );
  } finally {
    await fixture('project_members', 'POST', {
      project_id: project,
      user_id: viewer,
      role: 'viewer',
    });
  }
  await page.goto(`/snags/${id}`);
  await expect(page.getByText('Live updates connected', { exact: true })).toBeVisible();
  await managerRpc('soft_delete_snag', { p_snag_id: id });
  await expect(page.getByRole('heading', { name: 'Access reconciliation defect' })).toHaveCount(0, {
    timeout: 20_000,
  });
});

test('rejection requires a reason and preserves it with focused feedback after a failed request', async ({
  page,
}, info) => {
  const id = await createSnag('Review failure defect');
  await managerRpc('assign_snag', { p_snag_id: id, p_assignee_id: member });
  await managerRpc('transition_snag', { p_snag_id: id, p_to_status: 'in_progress' });
  await managerRpc('transition_snag', { p_snag_id: id, p_to_status: 'ready_for_review' });
  await login(page, 'manager');
  await page.goto(`/snags/${id}`);
  const form = page.getByRole('form', { name: 'Reject back to assignee', exact: true });
  await form.getByRole('button', { name: 'Reject back to assignee' }).click();
  expect(
    await form
      .getByLabel(/^Rejection reason/)
      .evaluate((element: HTMLTextAreaElement) => element.validity.valueMissing),
  ).toBe(true);
  await form.getByLabel(/^Rejection reason/).fill('Retained rejection draft');
  await page.route('**/snags/**', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  await form.getByRole('button', { name: 'Reject back to assignee' }).click();
  await expect(form.getByRole('alert')).toContainText('could not be confirmed');
  await expect(form.getByRole('alert')).toBeFocused();
  await expect(form.getByLabel(/^Rejection reason/)).toHaveValue('Retained rejection draft');
  await page.unroute('**/snags/**');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html { font-size: 20px !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('review-phone-large-text.png'), fullPage: true });
  await form.getByRole('button', { name: 'Reject back to assignee' }).click();
  await expect(page.getByText('Retained rejection draft', { exact: true })).toBeVisible();
});

test('manager rejects, assignee resubmits, manager approves and reopens with reasons', async ({
  page,
  browser,
}) => {
  const id = await createSnag('Full phase three workflow');
  await login(page, 'manager');
  await page.goto(`/snags/${id}`);
  await page.getByLabel('Assign to', { exact: true }).selectOption(member);
  await page.getByRole('button', { name: 'Update assignment' }).click();
  const queue = await page.context().newPage();
  await queue.goto('/dashboard');
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await login(other, 'member1');
    await other.goto(`/snags/${id}`);
    await other.getByRole('button', { name: 'Start work', exact: true }).click();
    await other.getByRole('button', { name: 'Mark ready for review', exact: true }).click();
    await queue.bringToFront();
    await expect(
      queue
        .getByRole('region', { name: 'Review queue' })
        .getByRole('link', { name: /Full phase three workflow/ }),
    ).toBeVisible();
    await page.bringToFront();
    await expect(
      page.getByRole('button', { name: 'Approve and close', exact: true }),
    ).toBeVisible();
    await page.getByLabel(/^Rejection reason/).fill('Finish the edge properly');
    await page.getByRole('button', { name: 'Reject back to assignee' }).click();
    await other.bringToFront();
    await expect(other.getByText('Finish the edge properly', { exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Approve and close', exact: true })).toHaveCount(
      0,
    );
    await other.getByRole('button', { name: 'Mark ready for review', exact: true }).click();
    await page.bringToFront();
    await page.getByRole('button', { name: 'Approve and close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
    await queue.bringToFront();
    await expect(
      queue
        .getByRole('region', { name: 'Review queue' })
        .getByRole('link', { name: /Full phase three workflow/ }),
    ).toHaveCount(0);
    await page.bringToFront();
    await page.getByLabel(/^Reopen reason/).fill('Issue found at inspection');
    await page.getByRole('button', { name: 'Reopen', exact: true }).click();
    await expect(page.getByText('Issue found at inspection', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start work', exact: true })).toBeVisible();
    await expect
      .poll(async () => (await fixture(`snags?id=eq.${id}`))[0])
      .toMatchObject({
        status: 'open',
        rejection_count: 1,
        closed_at: null,
      });
  } finally {
    await context.close();
    await queue.close();
  }
});
