import { defineConfig, devices } from '@playwright/test';

// UI-only checks with actual Next routes and a local fixture HTTP transport.
// Existing playwright.config.ts remains the real Supabase/Auth E2E suite.
export default defineConfig({
  testDir: './tests',
  testMatch: 'fieldwork.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3005',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'fieldwork-chrome',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env['E2E_CHANNEL'] === 'bundled' ? {} : { channel: 'chrome' }),
      },
    },
  ],
  webServer: [
    {
      command: 'node fixtures/fieldwork-api.mjs',
      url: 'http://127.0.0.1:55440/auth/v1/settings',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: `pnpm --filter web ${process.env['UI_PRODUCTION'] === '1' ? 'start' : 'dev'} --hostname 127.0.0.1 --port 3005`,
      url: 'http://127.0.0.1:3005/login',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55440',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon-key',
        SUPABASE_SERVER_URL: 'http://127.0.0.1:55440',
      },
    },
  ],
});
