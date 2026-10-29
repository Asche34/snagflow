import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const settings: Record<string, string | undefined> = { ...process.env };
for (const file of ['../supabase/tests/test.env', '../supabase.env']) {
  if (!existsSync(resolve(file))) continue;
  for (const line of readFileSync(resolve(file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
    if (m && !settings[m[1]!]) settings[m[1]!] = m[2]!;
  }
}
const api = settings['SUPABASE_URL'] ?? settings['API_URL'];
const key = settings['SUPABASE_SERVICE_ROLE_KEY'] ?? settings['SERVICE_ROLE_KEY'];
const project = crypto.randomUUID();
const run = `team-${Date.now().toString(36)}`;
const manager = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const viewer = '55555555-5555-4555-8555-555555555555';
const admin = '11111111-1111-4111-8111-111111111111';
const path = `/projects/${project}?tab=team`;
async function fixture(resource: string, method = 'GET', body?: unknown) {
  if (!api || !key) throw new Error('Team E2E requires local fixture credentials');
  const r = await fetch(`${api}/rest/v1/${resource}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Team fixture ${method} status ${r.status}`);
  return r;
}
async function login(page: Page, email = 'manager@snagflow.test', password = 'Password123!') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
const team = (page: Page) => page.getByRole('region', { name: 'Project team', exact: true });
test.beforeAll(async () => {
  await fixture('projects', 'POST', {
    id: project,
    code: run,
    name: 'Team management test site',
    created_by: admin,
  });
  await fixture('project_members', 'POST', [
    { project_id: project, user_id: manager, role: 'manager' },
    { project_id: project, user_id: member, role: 'member' },
    { project_id: project, user_id: viewer, role: 'viewer' },
  ]);
});
test.afterAll(async () => {
  await fixture(`projects?id=eq.${project}`, 'DELETE');
  if (!api || !key) return;
  const response = await fetch(`${api}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error('Auth fixture cleanup listing failed');
  const { users } = (await response.json()) as { users: { id: string; email: string }[] };
  for (const user of users.filter((u) => u.email.startsWith(run))) {
    const r = await fetch(`${api}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error('Auth fixture cleanup failed');
  }
});

test('manager adds an existing user, changes role and confirms removal', async ({ page }) => {
  await login(page);
  await page.goto(path);
  await team(page)
    .getByLabel('Existing account email', { exact: true })
    .fill('member2@snagflow.test');
  await team(page).getByRole('button', { name: 'Add member', exact: true }).click();
  const row = team(page).getByRole('listitem').filter({ hasText: 'member2@snagflow.test' });
  await expect(row).toBeVisible();
  await row.getByLabel('Project role', { exact: true }).selectOption('viewer');
  await row.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(row.getByLabel('Project role', { exact: true })).toHaveValue('viewer');
  await row.getByRole('button', { name: 'Remove member', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Confirm removal', exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(row).toHaveCount(0);
});

test('viewer/member roster stays read-only and managers cannot send new-account invitations', async ({
  page,
}) => {
  for (const email of ['viewer@snagflow.test', 'member1@snagflow.test']) {
    await login(page, email);
    await page.goto(path);
    await expect(team(page)).toContainText('manager@snagflow.test');
    await expect(team(page).getByRole('button', { name: 'Add member', exact: true })).toHaveCount(
      0,
    );
    await expect(team(page).getByRole('button', { name: 'Save role', exact: true })).toHaveCount(0);
  }
  await login(page);
  await page.goto(path);
  await expect(
    team(page).getByRole('button', { name: 'Send invitation', exact: true }),
  ).toHaveCount(0);
  const r = await page.request.post('/api/invitations', {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      clientId: crypto.randomUUID(),
      projectId: project,
      email: `${run}-denied@snagflow.test`,
      role: 'manager',
    },
  });
  expect(r.status()).toBe(403);
});

test('revocation after load prevents adding users and retains the email draft', async ({
  page,
}) => {
  await login(page);
  await page.goto(path);
  await team(page)
    .getByLabel('Existing account email', { exact: true })
    .fill('member2@snagflow.test');
  await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
    role: 'viewer',
  });
  try {
    await team(page).getByRole('button', { name: 'Add member', exact: true }).click();
    await expect(team(page).getByRole('alert')).toContainText('permission');
    // Let any post-action RSC refresh settle before asserting that the draft survived.
    await page.waitForLoadState('networkidle');
    await expect(team(page).getByLabel('Existing account email', { exact: true })).toHaveValue(
      'member2@snagflow.test',
    );
  } finally {
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
      role: 'manager',
    });
  }
});

async function emailLink(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const inbox = (await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json()) as {
        messages: { ID: string; To: { Address: string }[] }[];
      };
      id = inbox.messages.find((m) => m.To.some((to) => to.Address === email))?.ID;
      return !!id;
    })
    .toBe(true);
  const message = (await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()) as {
    HTML: string;
  };
  const link = message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!link) throw new Error('Local invitation email has no action link');
  return link;
}

test('admin email invitation reaches local mail capture and recipient joins with chosen password', async ({
  page,
  browser,
}) => {
  const email = `${run}-new@snagflow.test`;
  await login(page, 'admin@snagflow.test');
  await page.goto(path);
  await team(page).getByLabel('Invitation email', { exact: true }).fill(email);
  await team(page).getByLabel('Invitation role', { exact: true }).selectOption('viewer');
  await team(page).getByRole('button', { name: 'Send invitation', exact: true }).click();
  await expect(team(page).getByRole('status')).toContainText('Invitation sent');
  const link = await emailLink(email);
  const context = await browser.newContext();
  try {
    const recipient = await context.newPage();
    await recipient.goto(link);
    await expect(
      recipient.getByRole('heading', { name: 'Accept invitation', exact: true }),
    ).toBeVisible();
    await expect(recipient.getByRole('form', { name: 'Accept project invitation' })).toBeVisible();
    await recipient.getByLabel('Full name', { exact: true }).fill('Invited colleague');
    await recipient.getByLabel('New password', { exact: true }).fill('InvitedPassword123!');
    await recipient.getByRole('button', { name: 'Join project', exact: true }).click();
    await expect(
      recipient.getByRole('heading', { name: 'Team management test site', exact: true }),
    ).toBeVisible();
    await expect(recipient.getByRole('link', { name: 'New snag', exact: true })).toHaveCount(0);
    await recipient.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(recipient, email, 'InvitedPassword123!');
    await recipient.goto(path);
    await expect(team(recipient)).toContainText('Invited colleague');
  } finally {
    await context.close();
  }
});

test('pending invitation can be canceled; wrong user and canceled token grant no access', async ({
  page,
}) => {
  const email = `${run}-cancel@snagflow.test`;
  await login(page, 'admin@snagflow.test');
  await page.goto(path);
  await team(page).getByLabel('Invitation email', { exact: true }).fill(email);
  await team(page).getByRole('button', { name: 'Send invitation', exact: true }).click();
  await expect(team(page).getByRole('status')).toContainText('Invitation sent');
  const [inv] = await (await fixture(`invites?project_id=eq.${project}&email=eq.${email}`)).json();
  const pending = team(page).getByRole('listitem').filter({ hasText: email });
  await pending.getByRole('button', { name: 'Cancel invitation', exact: true }).click();
  await expect(pending).toHaveCount(0);
  await page.goto(`/invite/${inv.token}`);
  await expect(
    page.getByText('This invitation is unavailable, expired, or belongs to another account.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('team controls reflow on phone and desktop and with enlarged text', async ({
  page,
}, testInfo) => {
  await login(page, 'admin@snagflow.test');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await expect(team(page).getByLabel('Invitation email', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`team-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a consumed invitation link can recover a lost session before account setup', async ({
  page,
  browser,
}) => {
  const email = `${run}-recover@snagflow.test`;
  await login(page, 'admin@snagflow.test');
  await page.goto(path);
  await team(page).getByLabel('Invitation email', { exact: true }).fill(email);
  await team(page).getByRole('button', { name: 'Send invitation', exact: true }).click();
  await expect(team(page).getByRole('status')).toContainText('Invitation sent');
  const original = await emailLink(email);
  const firstContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    await first.goto(original);
    await expect(first.getByRole('form', { name: 'Accept project invitation' })).toBeVisible();
  } finally {
    await firstContext.close();
  }
  const pending = team(page).getByRole('listitem').filter({ hasText: email });
  await pending.getByRole('button', { name: 'Retry send', exact: true }).click();
  await expect(team(page).getByRole('status')).toContainText('Invitation sent');
  let recovered = '';
  await expect
    .poll(async () => {
      recovered = await emailLink(email);
      return recovered !== original;
    })
    .toBe(true);
  const secondContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    await second.goto(recovered);
    await expect(second.getByRole('form', { name: 'Accept project invitation' })).toBeVisible();
    await second.getByLabel('Full name', { exact: true }).fill('Recovered colleague');
    await second.getByLabel('New password', { exact: true }).fill('RecoveredPassword123!');
    await second.getByRole('button', { name: 'Join project', exact: true }).click();
    await expect(
      second.getByRole('heading', { name: 'Team management test site', exact: true }),
    ).toBeVisible();
  } finally {
    await secondContext.close();
  }
});

test('own-role demotion requires confirmation before losing team controls', async ({ page }) => {
  await login(page);
  await page.goto(path);
  const own = team(page).getByRole('listitem').filter({ hasText: 'manager@snagflow.test' });
  await own.getByLabel('Project role', { exact: true }).selectOption('viewer');
  await own.getByRole('button', { name: 'Save role', exact: true }).click();
  try {
    await expect(
      own.getByRole('button', { name: 'Confirm role change', exact: true }),
    ).toBeVisible();
    const [before] = await (
      await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`)
    ).json();
    expect(before.role).toBe('manager');
    await own.getByRole('button', { name: 'Confirm role change', exact: true }).click();
    await expect(team(page).getByRole('button', { name: 'Add member', exact: true })).toHaveCount(
      0,
    );
  } finally {
    await fixture(`project_members?project_id=eq.${project}&user_id=eq.${manager}`, 'PATCH', {
      role: 'manager',
    });
  }
});

test('public email registration remains disabled', async () => {
  const anon = settings['SUPABASE_ANON_KEY'] ?? settings['ANON_KEY'];
  if (!api || !anon) throw new Error('Missing local Auth configuration');
  const response = await fetch(`${api}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${run}-public@snagflow.test`, password: 'PublicAttempt123!' }),
  });
  const result = (await response.json()) as { code?: string | number; error_code?: string };
  expect(response.ok).toBe(false);
  expect(result.error_code ?? result.code).toBe('signup_disabled');
});
