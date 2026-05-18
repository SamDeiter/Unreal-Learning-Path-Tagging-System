/**
 * E2E: Tab navigation smoke tests
 */
import { test, expect } from "@playwright/test";

test.describe("Tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    // Set persona to bypass quiz modal
    await page.evaluate(() => {
      localStorage.setItem("ue5_persona_id", "programmer_pat");
    });
    await page.reload();
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    await page.waitForSelector("nav.sidebar-nav", { timeout: 10_000 });
  });

  test("should navigate to the Dashboard tab", async ({ page }) => {
    const tab = page.locator("button.sidebar-tab").filter({ hasText: /Dashboard/ });
    await expect(tab).toBeVisible();
    await tab.click();
    await page.waitForTimeout(500);
  });

  test("should navigate to the Tutor tab", async ({ page }) => {
    const tab = page.locator("button.sidebar-tab").filter({ hasText: /Tutor/ });
    await expect(tab).toBeVisible();
    await tab.click();
    await page.waitForTimeout(1_000);
  });

  test("should navigate between multiple tabs without crashing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const tabs = page.locator("button.sidebar-tab");
    const count = await tabs.count();

    const maxTabs = Math.min(count, 5);
    for (let i = 0; i < maxTabs; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }

    expect(errors).toEqual([]);
  });
});
