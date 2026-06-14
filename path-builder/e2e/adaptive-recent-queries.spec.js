import { test, expect } from '@playwright/test';

test('Adaptive Path: Recent query deletion', async ({ page }) => {
  // 1. Navigate to the app and bypass auth/onboarding
  await page.goto('http://localhost:5173/Unreal-Learning-Path-Tagging-System/');

  await page.evaluate(() => {
    localStorage.setItem('e2e_auth_bypass', 'true');
    localStorage.setItem('ue5_persona_id', 'standard');
    localStorage.setItem('ue5_recent_queries', JSON.stringify(['Niagara Particles', 'Blueprint Communication']));
  });

  await page.reload();

  // 2. Navigate to Adaptive Path tab (assuming TabRouter or similar handles navigation)
  // Based on TabRouter.jsx and AppSidebar.jsx, "Adaptive Path" is likely a tab.
  // We'll look for a button or link with "Adaptive Path" text.
  const adaptiveTab = page.getByRole('button', { name: /Adaptive Path/i }).first();
  await adaptiveTab.click();

  // 3. Verify queries appear in the recent questions section
  await expect(page.locator('.recent-query-card').filter({ hasText: 'Niagara Particles' })).toBeVisible();
  await expect(page.locator('.recent-query-card').filter({ hasText: 'Blueprint Communication' })).toBeVisible();

  // 4. Delete the first query
  // The delete button is in .recent-query-wrapper along with the text.
  const firstQueryWrapper = page.locator('.recent-query-wrapper').filter({ hasText: 'Niagara Particles' });
  const deleteBtn = firstQueryWrapper.getByLabel('Remove recent query');

  // Need to hover to make it visible in some cases, but Playwright's click() often handles visibility
  await deleteBtn.click();

  // 5. Verify it's gone from the UI
  await expect(page.locator('.recent-query-card').filter({ hasText: 'Niagara Particles' })).not.toBeVisible();
  await expect(page.locator('.recent-query-card').filter({ hasText: 'Blueprint Communication' })).toBeVisible();

  // 6. Verify it's gone from localStorage
  const storedQueries = await page.evaluate(() => JSON.parse(localStorage.getItem('ue5_recent_queries')));
  expect(storedQueries).not.toContain('Niagara Particles');
  expect(storedQueries).toContain('Blueprint Communication');
});
