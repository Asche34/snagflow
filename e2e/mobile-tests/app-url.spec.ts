import { test, expect } from '@playwright/test';
test('an unavailable deployment can be left locally to change App URL', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('manager@snagflow.test');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fieldwork', exact: true })).toBeVisible();
  await page.route('**/auth/v1/**', (route) => route.abort());
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.getByRole('button', { name: 'Change app URL', exact: true }).click();
  await expect(page.getByLabel('App URL', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Fieldwork', exact: true })).toHaveCount(0);
});
test('App URL discovery is public, versioned and contains only public configuration', async ({
  request,
}) => {
  const response = await request.get('http://127.0.0.1:3003/api/mobile-config');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['access-control-allow-origin']).toBe('*');
  const config = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(config).sort()).toEqual([
    'application',
    'supabaseAnonKey',
    'supabaseUrl',
    'version',
  ]);
  expect(config['application']).toBe('SnagFlow');
  expect(config['version']).toBe(1);
});
test('URL edits require connection verification, bad URLs preserve the current connection, and the selected URL survives reload', async ({
  page,
}) => {
  await page.goto('/login');
  const url = page.getByLabel('App URL', { exact: true });
  await expect(url).toHaveValue('http://127.0.0.1:3003');
  await url.fill('http://localhost:39999');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await page.route('http://localhost:39999/api/mobile-config', (route) =>
    route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }),
  );
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(
    page.getByText('This address did not provide SnagFlow connection settings.', { exact: false }),
  ).toBeVisible();
  await url.fill('http://127.0.0.1:3003');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await url.fill('http://localhost:3003');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(
    page.getByText('Connected to http://localhost:3003', { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('App URL', { exact: true })).toHaveValue('http://localhost:3003');
  await page.getByLabel('Email', { exact: true }).fill('manager@snagflow.test');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fieldwork', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fieldwork', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('App URL', { exact: true })).toHaveValue('http://localhost:3003');
  await page.getByLabel('App URL', { exact: true }).fill('http://127.0.0.1:3003');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(
    page.getByText('Connected to http://127.0.0.1:3003', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('phone-app-url.png'), fullPage: true });
});
