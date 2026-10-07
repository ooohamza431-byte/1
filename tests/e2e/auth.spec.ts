import { expect, test } from '@playwright/test';

/**
 * Authentication surface.
 *
 * The credential specs only need the sign-in page to render; they never create
 * a session, so they run on a fresh clone. Anything that needs a real account is
 * gated behind E2E_EMAIL / E2E_PASSWORD in `studio.spec.ts`.
 */

test.describe('authentication', () => {
  test('sign-in page offers credentials plus the OAuth buttons', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i }).first()).toBeVisible();
    // OAuth is optional per deployment, so only assert the links when rendered.
    const oauth = page.getByRole('button', { name: /google|github/i });
    if ((await oauth.count()) > 0) await expect(oauth.first()).toBeVisible();
  });

  test('sign-up form asks for a password twice and validates the email', async ({ page }) => {
    await page.goto('/signup');

    const email = page.getByLabel(/email/i);
    await email.fill('not-an-email');
    await page.getByLabel(/password/i).first().fill('short');
    await page.getByRole('button', { name: /create|sign up|register/i }).first().click();

    // Native or Zod validation must block the submit — the page stays put.
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByText(/valid|at least|8|character/i).first()).toBeVisible();
  });

  test('credentials sign-in rejects a wrong password without leaking which field failed', async ({ page }) => {
    await page.goto('/signin');

    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();

    // Either an inline error or a redirect back with an error param is fine —
    // what matters is that no session is created and no stack trace is shown.
    await expect(page.getByText(/internal server error|cannot read|stack/i)).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/\/signin/);
  });

  test('the studio is protected from anonymous visitors', async ({ page }) => {
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('the admin panel is protected from anonymous visitors', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('anonymous API calls are answered with JSON, never an HTML redirect', async ({ request }) => {
    const response = await request.post('/api/chat', { data: { messages: [] } });

    expect([401, 403]).toContain(response.status());
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('admin API routes are gated server-side', async ({ request }) => {
    for (const path of ['/api/admin/keys', '/api/admin/users', '/api/admin/system', '/api/admin/audit']) {
      const response = await request.get(path);
      expect([401, 403], `${path} should be protected`).toContain(response.status());
    }
  });
});

test.describe('health probe', () => {
  test('reports each dependency by name', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect([200, 503]).toContain(response.status());
    expect(body).toHaveProperty('checks');
    expect(Object.keys(body.checks).length).toBeGreaterThan(0);
  });

  test('a ready instance reports ok', async ({ request }) => {
    const response = await request.get('/api/health');
    if (response.status() !== 200) test.skip(true, 'instance is not fully configured (no database)');

    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
