import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * `E2E_BASE_URL` points at the running web app (default: the Docker container on
 * http://localhost:3000). `E2E_CHANNEL` selects the browser: `chrome` uses the
 * locally installed Google Chrome (no browser download needed), `bundled` uses
 * the Playwright-managed Chromium (what CI installs).
 */
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
const channel = process.env["E2E_CHANNEL"] ?? "chrome";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "fieldwork.spec.ts",
  /* The stack is shared: one worker keeps the seeded data predictable. */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(channel === "bundled" ? {} : { channel }),
      },
    },
  ],
});
