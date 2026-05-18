/**
 * E2E: Search functionality smoke test
 */
import { test, expect } from "@playwright/test";

test.describe("Search flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    // Set persona then reload to dismiss quiz
    await page.evaluate(() => {
      localStorage.setItem("ue5_persona_id", "programmer_pat");
    });
    await page.reload();
    await page.waitForSelector(".auth-gate-authorized", { timeout: 15_000 });
    await page.waitForSelector("nav.sidebar-nav", { timeout: 10_000 });

    // Navigate to Tutor
    const tab = page.locator("button.sidebar-tab").filter({ hasText: /Tutor/ });
    await tab.click();

    // Reveal the legacy ProblemInput via details summary
    const summary = page.locator("summary", { hasText: /Attach a screenshot or error log/ });
    await summary.click();
    await page.getByLabel("Problem description").waitFor({ timeout: 5_000 });
  });

  test("should accept a search query", async ({ page }) => {
    const textarea = page.getByLabel("Problem description");
    await textarea.fill("Lumen reflections flickering in my level");
    await expect(textarea).toHaveValue(/Lumen reflections/);
  });

  test("should show the Get Diagnosis button", async ({ page }) => {
    const submitBtn = page.locator("button", { hasText: /Get Diagnosis/ });
    await expect(submitBtn).toBeVisible();
  });

  test("should submit a query without fatal errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const textarea = page.getByLabel("Problem description");
    await textarea.fill("How to fix black screen in UE5");

    const submitBtn = page.locator("button", { hasText: /Get Diagnosis/ });
    await submitBtn.click();

    await page.waitForTimeout(3_000);

    const fatalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network")
    );
    expect(fatalErrors).toEqual([]);
  });
});
