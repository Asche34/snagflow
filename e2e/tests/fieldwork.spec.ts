import { expect, test, type Page } from '@playwright/test';

// The production bundle contains its build-time public backend URL. Keep the
// fixture-only browser traffic isolated too; live behavior uses real Supabase
// in phase3.spec.ts. Never send a fixture JWT to the real local stack.
test.beforeEach(async ({ page }) => {
  await page.route(/\/rest\/v1\/notifications(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'content-range': '*/0' },
      body: route.request().method() === 'HEAD' ? '' : '[]',
    }),
  );
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
    socket.onMessage((message) => {
      const raw = JSON.parse(String(message));
      const [join, ref, topic, event, payload] = Array.isArray(raw)
        ? raw
        : [raw.join_ref, raw.ref, raw.topic, raw.event, raw.payload];
      if (event !== 'phx_join' && event !== 'heartbeat') return;
      const response = {
        status: 'ok',
        response: {
          postgres_changes: (payload?.config?.postgres_changes ?? []).map(
            (scope: object, id: number) => ({ ...scope, id }),
          ),
        },
      };
      socket.send(
        JSON.stringify(
          Array.isArray(raw)
            ? [join, ref, topic, 'phx_reply', response]
            : { join_ref: join, ref, topic, event: 'phx_reply', payload: response },
        ),
      );
    });
  });
});

async function login(page: Page, role = 'manager') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@snagflow.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test('phone project navigation works and restores focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole('link', { name: /Riverside Health Hub/ }).click();
  await expect(page).toHaveURL(/projects\/10101010/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Riverside Health Hub' })).toBeVisible();
});

test('mixed-role review queue contains only projects the manager can review', async ({ page }) => {
  await login(page);
  const queue = page.getByRole('region', { name: 'Review queue', exact: true });
  await expect(queue.getByText('Fire door closer needs adjustment')).toBeVisible();
  await expect(queue.getByText('Mixed-role review item')).toHaveCount(0);
});

test('phone cards preserve long titles and due dates without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto('/projects/10101010-1010-4101-8101-101010101010');
  const longTitle = page.getByText(
    'Check emergency lighting and fire-rated containment above the suspended ceiling before final handover',
    { exact: true },
  );
  await expect(longTitle).toBeVisible();
  const row = page.getByRole('link').filter({ has: longTitle });
  await expect(row.getByText(/Overdue by/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('viewer sees details without workflow or comment actions', async ({ page }) => {
  await login(page, 'viewer');
  await page.goto('/snags/12010101-0101-4101-8101-000000000001');
  await expect(
    page.getByRole('heading', { name: 'Fire door closer needs adjustment' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve and close' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject back to assignee' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Post comment' })).toHaveCount(0);
});

test('workspace renders without client rendering errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await login(page);
  await expect(page.getByRole('heading', { name: /Good day, Morgan/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Fieldwork screens reflow across phone, tablet and desktop', async ({ page }, testInfo) => {
  await login(page);
  const screens = [
    ['dashboard', '/dashboard', 'Good day, Morgan.'],
    ['project', '/projects/10101010-1010-4101-8101-101010101010', 'Riverside Health Hub'],
    ['snag', '/snags/12010101-0101-4101-8101-000000000001', 'Fire door closer needs adjustment'],
  ];
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path, heading] of screens) {
      await page.goto(path!);
      await expect(page.getByRole('heading', { name: heading!, exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${name} overflow at ${width}`,
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
        caret: 'initial',
      });
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('login remains usable at phone and desktop widths', async ({ page }, testInfo) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`login-${width}.png`),
      fullPage: true,
      caret: 'initial',
    });
  }
});

test('enlarged phone text keeps controls clear of fixed navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto('/snags/12010101-0101-4101-8101-000000000001');
  await expect(
    page.getByRole('heading', { name: 'Fire door closer needs adjustment' }),
  ).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    overflow: [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 12)
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        text: el.textContent?.slice(0, 40),
      })),
  }));
  expect(layout.width <= layout.viewport, JSON.stringify(layout)).toBe(true);
  const submit = page.getByRole('button', { name: 'Post comment' });
  await page.getByLabel('Add a comment', { exact: true }).fill('Phone keyboard update');
  await submit.focus();
  await submit.scrollIntoViewIfNeeded();
  const bounds = await submit.boundingBox();
  const navigation = await page.getByRole('navigation', { name: 'Phone navigation' }).boundingBox();
  expect(bounds).not.toBeNull();
  expect(navigation).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navigation!.y);
});

test('unavailable comment reads show a retry state while composition remains available', async ({
  page,
  request,
}) => {
  await login(page);
  await request.put('http://127.0.0.1:55440/_test/comments-failure?enabled=true');
  try {
    await page.goto('/snags/12010101-0101-4101-8101-000000000001');
    const thread = page.getByRole('region', { name: 'Comments' });
    await expect(thread.getByRole('alert')).toContainText('Comments could not be loaded');
    await expect(thread.getByText('No comments yet.', { exact: true })).toHaveCount(0);
    await expect(thread.getByLabel('Add a comment', { exact: true })).toBeVisible();
    await request.put('http://127.0.0.1:55440/_test/comments-failure?enabled=false');
    await thread.getByRole('link', { name: 'Refresh comments' }).click();
    await expect(thread).toContainText('Adjustment complete.');
    await expect(thread.getByRole('alert')).toHaveCount(0);
  } finally {
    await request.put('http://127.0.0.1:55440/_test/comments-failure?enabled=false');
  }
});
