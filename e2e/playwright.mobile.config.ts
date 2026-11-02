import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './mobile-tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: './.playwright/phase5-mobile',
  use: {
    baseURL: process.env['MOBILE_E2E_BASE_URL'] ?? 'http://127.0.0.1:8085',
    channel: 'chrome',
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
