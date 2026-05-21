/**
 * E2E: Search functionality smoke test
 *
 * The Tutor tab's primary input is now `ChatInput` (aria-label "Chat input",
 * "Send" button). The legacy `ProblemInput` ("Problem description" /
 * "Get Diagnosis") still exists but is nested inside a collapsed <details>
 * for attaching a screenshot or error log — so it's hidden on initial load.
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

    // Navigate to the Tutor tab (formerly "Fix a Problem", briefly "Learn Why").
    // Renamed in commit 24fd6e21 — product IS the digital tutor now.
    const tab = page.locator("button.sidebar-tab").filter({ hasText: /Tutor/ });
    await tab.click();
    await page.getByLabel("Chat input").waitFor({ timeout: 5_000 });
  });

  test("should accept a search query", async ({ page }) => {
    const textarea = page.getByLabel("Chat input");
    await textarea.fill("Lumen reflections flickering in my level");
    await expect(textarea).toHaveValue(/Lumen reflections/);
  });

  test("should show the Send button", async ({ page }) => {
    const submitBtn = page.getByRole("button", { name: /^Send$/i });
    await expect(submitBtn).toBeVisible();
  });

  test("should submit a query without fatal errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const textarea = page.getByLabel("Chat input");
    await textarea.fill("How to fix black screen in UE5");

    const submitBtn = page.getByRole("button", { name: /^Send$/i });
    // ChatInput requires >=10 chars before enabling Send; the fill above
    // satisfies that, but assert before clicking to fail fast if a regression
    // breaks the enablement logic.
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await page.waitForTimeout(3_000);

    const fatalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network")
    );
    expect(fatalErrors).toEqual([]);
  });
});
