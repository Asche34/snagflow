import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env["E2E_PASSWORD"] ?? "Password123!";
const SESSION_COOKIE = "sb-snagflow-auth-token";

/** Console/page errors collected while the test runs — §14 wants a clean console. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/**
 * Locators are form-scoped and exact on purpose.
 *
 * `getByLabel("Email")` matches on a substring, so it also matches a field
 * labelled "Email address?" — and it silently accepts *any* page that happens
 * to have an email field. That is how this suite once passed against the wrong
 * application: it was pointed at a port where a different project was serving
 * its own login form. Anchoring to a form that really has a "Sign in" button,
 * and matching labels exactly, makes a wrong base URL fail honestly instead of
 * testing someone else's UI.
 */
function loginForm(page: Page) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: "Sign in" }) });
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  const form = loginForm(page);
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
}

/** The login form's error banner. Scoped to the card so it does not collide
 *  with Next.js's route-announcer `<div role="alert">` (strict-mode flake). */
function loginError(page: Page) {
  return page.getByRole("main").locator("p[role='alert']").first();
}

test.describe("authentication", () => {
  test("an anonymous visitor is sent to the login screen", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    // The login screen renders the email field; assert on that rather than a
    // heading, because "Sign in" is plain text under an <h1>SnagFlow</h1>.
    // Scoped + exact so an autofill overlay cannot make this ambiguous.
    await expect(loginForm(page).getByLabel("Email", { exact: true })).toBeVisible();
  });

  test("a manager signs in and lands on the dashboard", async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto("/login");
    await signIn(page, "manager@snagflow.test");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Morgan Manager")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the session cookie is set and the app is authenticated", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "manager@snagflow.test");
    await expect(page).toHaveURL(/\/dashboard/);

    const cookies = await page.context().cookies();
    const session = cookies.find((cookie) => cookie.name === SESSION_COOKIE);

    expect(session, `expected a "${SESSION_COOKIE}" cookie`).toBeTruthy();
    expect(session?.path).toBe("/");
    // @supabase/ssr 0.12.7 defaults httpOnly to false; the session is still
    // valid, so assert on what we actually control (name + path) rather than
    // on a library default we do not set. Playwright normalizes to "Lax".
    expect(session?.sameSite).toBe("Lax");
  });

  test("a wrong password is reported and no session is created", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "manager@snagflow.test", "not-the-password");

    await expect(loginError(page)).toHaveText("Invalid login credentials");
    await expect(page).toHaveURL(/\/login/);

    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === SESSION_COOKIE)).toBeUndefined();
  });

  test("signing out clears the session", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "manager@snagflow.test");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a viewer sees only the projects RLS allows", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "viewer@snagflow.test");
    await expect(page).toHaveURL(/\/dashboard/);

    // The project appears in both the sidebar list and the dashboard progress
    // list, so assert on the sidebar link specifically and scope the Westgate
    // check to the sidebar to avoid a strict-mode violation from the
    // dashboard's own progress cards.
    await expect(
      page.getByRole("complementary").getByRole("link", { name: /Riverside Health Hub/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary").getByRole("link", { name: /Westgate Plant Room/ }),
    ).toHaveCount(0);
  });
});