/**
 * E2E: App loads and shows the main layout
 */
import { test, expect } from "@playwright/test";

test.describe("App startup", () => {
  test("should load the app without JS errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    // Auth bypass renders .auth-gate-authorized immediately
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    await page.waitForSelector("nav.main-nav", { timeout: 10_000 });

    expect(errors).toEqual([]);
  });

  test("should display the app header", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    await page.waitForSelector("nav.main-nav", { timeout: 10_000 });
    const header = page.getByText("UE5 Learning Path Builder");
    await expect(header).toBeVisible();
  });

  test("should render navigation tabs", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    await page.waitForSelector("nav.main-nav", { timeout: 10_000 });
    const tabs = page.locator("button.nav-tab");
    await expect(tabs.first()).toBeVisible();

    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
