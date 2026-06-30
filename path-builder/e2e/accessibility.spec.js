import { test, expect } from "@playwright/test";

test.describe("Accessibility Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Standard bypass for auth and onboarding
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("ue5_persona_id", "developer");
      localStorage.setItem("ue5_onboarding_completed", "true");
      localStorage.setItem("e2e_auth_bypass", "true");
    });
    await page.reload();
    await page.waitForSelector(".sidebar-nav", { timeout: 15_000 });
  });

  test("should have correct ARIA attributes and manage focus", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Accessibility settings" });
    await expect(trigger).toBeVisible();

    // Verify initial ARIA attributes
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await expect(trigger).toHaveAttribute("aria-controls", "a11y-popover");

    // Open the panel
    await trigger.click();

    // Verify ARIA expanded
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Verify popover attributes
    const popover = page.locator("#a11y-popover");
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute("role", "dialog");
    await expect(popover).toHaveAttribute("aria-modal", "true");

    // Close the panel using the X button
    const closeBtn = page.getByRole("button", { name: "Close" });
    await closeBtn.click();

    // Verify panel is hidden
    await expect(popover).not.toBeVisible();

    // Verify focus returned to trigger
    await expect(trigger).toBeFocused();

    // Verify ARIA expanded is false again
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Open again to test Escape key
    await trigger.click();
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});
