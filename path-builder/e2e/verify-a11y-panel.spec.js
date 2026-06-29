import { test, expect } from '@playwright/test';

test('AccessibilityPanel focus management and ARIA attributes', async ({ page }) => {
  await page.goto('./');

  // Bypass onboarding and auth
  await page.evaluate(() => {
    localStorage.setItem('ue5_persona_id', 'developer');
    localStorage.setItem('ue5_onboarding_completed', 'true');
    localStorage.setItem('e2e_auth_bypass', 'true');
  });
  await page.reload();

  const trigger = page.locator('.a11y-panel__trigger');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  // Open the panel
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const popover = page.locator('.a11y-panel__popover');
  await expect(popover).toBeVisible();
  await expect(popover).toHaveAttribute('role', 'dialog');
  await expect(popover).toHaveAttribute('aria-modal', 'true');

  // Take screenshot
  await page.screenshot({ path: 'a11y-panel-open.png' });

  // Close with Escape
  await page.keyboard.press('Escape');
  await expect(popover).not.toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  // Verify focus returned to trigger
  await expect(trigger).toBeFocused();

  // Open again and close with the Close button
  await trigger.click();
  await expect(popover).toBeVisible();
  const closeBtn = page.locator('.a11y-panel__close');
  await closeBtn.click();
  await expect(popover).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
