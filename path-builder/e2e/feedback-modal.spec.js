import { test, expect } from '@playwright/test';

test('feedback modal accessibility and character count', async ({ page }) => {
  // Bypass auth and onboarding
  await page.addInitScript(() => {
    window.localStorage.setItem('e2e_auth_bypass', 'true');
    window.localStorage.setItem('ue5_persona_id', 'indie_isaac');
  });

  await page.goto('http://localhost:5173/Unreal-Learning-Path-Tagging-System/');

  // Find and click the feedback button
  const feedbackBtn = page.getByRole('button', { name: 'Send Feedback' });
  await expect(feedbackBtn).toBeVisible();
  await feedbackBtn.click();

  // Verify modal is open
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  // Check for required asterisk and visually hidden text
  const label = page.locator('label[for="feedback-desc"]');
  await expect(label).toContainText('*');

  // Verify character count updates
  const textarea = page.getByLabel(/Describe the issue|Tell us about your suggestion/);
  const charCount = page.locator('#feedback-char-count');

  await expect(charCount).toHaveText('0 characters');

  await textarea.fill('This is a test feedback message.');
  await expect(charCount).toHaveText('32 characters');

  // Verify disabled button contrast (indirectly by checking it is disabled when empty)
  await textarea.fill('');
  const submitBtn = page.getByRole('button', { name: 'Submit Feedback' });
  await expect(submitBtn).toBeDisabled();
});
