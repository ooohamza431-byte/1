import { expect, test } from '@playwright/test';

/**
 * Public marketing surface. These specs run against any instance — no account
 * and no database required — which makes them the first signal that a deploy
 * is serving pages at all.
 */

test.describe('marketing', () => {
  test('home page states the product and offers both entry points', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Nine providers and the six-agent pipeline are the two claims that define
    // the product; if a refactor drops them, this fails.
    await expect(page.getByText(/nine providers/i).first()).toBeVisible();
    await expect(page.getByText(/six-agent|6-agent/i).first()).toBeVisible();

    await expect(page.getByRole('link', { name: /get started|start building|create an account/i }).first()).toBeVisible();
  });

  test('home page ships inline theme tokens instead of a CDN stylesheet', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost') && !url.startsWith('data:')) {
        external.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The app must render with zero third-party requests: no CDN fonts, no CDN
    // syntax theme, no analytics beacon.
    expect(external.filter((url) => !url.includes('/_next/'))).toEqual([]);
  });

  test('cannot be scrolled into a horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('pricing explains the key resolution order', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/self-host/i).first()).toBeVisible();
    await expect(page.getByText(/key resolution order/i).first()).toBeVisible();

    // FAQs are real disclosure widgets, not decoration.
    const faq = page.locator('details').first();
    await expect(faq).toBeVisible();
    await faq.locator('summary').click();
    await expect(faq).toHaveAttribute('open', '');
  });

  test('docs cover the operator path from clone to deploy', async ({ page }) => {
    await page.goto('/docs');

    for (const heading of ['Quick start', 'Environment variables', 'Owner bootstrap', 'Admin panel', 'Deploy', 'Troubleshooting']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(page.getByText(/pnpm db:push/).first()).toBeVisible();
  });

  test('about page describes who builds it for', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('a 404 keeps the visitor inside the product', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-real-route');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/back|home|studio/i).first()).toBeVisible();
  });
});
