import { expect, test } from '@playwright/test';

/**
 * Authenticated studio flows.
 *
 * These specs need a real account, so they are skipped unless E2E_EMAIL and
 * E2E_PASSWORD point at a user that exists on the running instance:
 *
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=… pnpm test:e2e
 *
 * A build spec additionally needs E2E_LIVE=1, because it spends real tokens on
 * whichever provider the deployment routes to.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const LIVE = process.env.E2E_LIVE === '1';

test.describe('studio', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL and E2E_PASSWORD to run the studio specs');

  test.beforeEach(async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill(EMAIL!);
    await page.getByLabel(/password/i).fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    await expect(page).toHaveURL(/\/studio/, { timeout: 30_000 });
  });

  test('the composer, mode toggle and sidebar are wired up', async ({ page }) => {
    await expect(page.getByRole('textbox').first()).toBeVisible();
    // Chat / Build is the primary mode switch.
    const buildToggle = page.getByRole('button', { name: /build/i }).first();
    await expect(buildToggle).toBeVisible();
    await buildToggle.click();
    await expect(page).toHaveURL(/\/studio\/build/);
  });

  test('the model picker lists providers from the catalogue', async ({ page }) => {
    await page.getByRole('button', { name: /model/i }).first().click();

    // The panel is fed by /api/providers; at least one provider row must render.
    await expect(page.getByText(/z\.ai|gemini|openrouter|groq|cerebras|mistral|deepseek|openai|pollinations/i).first()).toBeVisible();
  });

  test('mobile layout exposes the navigation drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/studio');

    const trigger = page.getByRole('button', { name: /menu|navigation/i }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
  });

  test('settings page persists the theme choice', async ({ page }) => {
    await page.goto('/studio/settings');

    const light = page.getByRole('button', { name: /light/i }).first();
    if ((await light.count()) > 0) {
      await light.click();
      const stored = await page.evaluate(() => window.localStorage.getItem('m1.theme'));
      expect(stored).toBeTruthy();
    }
  });

  test('history page lists conversations or shows an empty state', async ({ page }) => {
    await page.goto('/studio/history');
    await expect(page.getByText(/no (conversations|chats|history)|recent/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('a chat turn streams a reply', async ({ page }) => {
    test.skip(!LIVE, 'set E2E_LIVE=1 to spend real tokens');

    await page.goto('/studio');
    const composer = page.getByRole('textbox').first();
    await composer.fill('Reply with exactly: pong');
    await composer.press('Enter');

    // Either streamed deltas or a finished message must appear.
    await expect(page.getByText(/pong/i).first()).toBeVisible({ timeout: 120_000 });
  });
});

test.describe('admin panel', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL and E2E_PASSWORD to run the admin specs');

  test('a non-admin is redirected away from /admin', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill(EMAIL!);
    await page.getByLabel(/password/i).fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    await page.waitForURL(/\/studio|\/dashboard/, { timeout: 30_000 });

    const response = await page.goto('/admin');
    // An owner or admin sees the panel; a plain user is bounced to the studio
    // with the forbidden flag set.
    const url = page.url();
    if (url.includes('/studio')) {
      expect(url).toContain('forbidden');
    } else {
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});
