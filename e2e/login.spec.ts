import { test, expect } from '@playwright/test';
import { SUPABASE_URL, MOCK_SESSION, MOCK_PROFILE, MOCK_USER } from './fixtures/mockData';
import { mockUnauthenticated } from './fixtures/auth';

test.describe('Login flow', () => {
  test('muestra el formulario de login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    await expect(page.getByPlaceholder('usuario@hospital.com')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('redirige a dashboard tras login exitoso', async ({ page }) => {
    await mockUnauthenticated(page);

    // Mock auth token endpoint (called on form submit)
    await page.route(`${SUPABASE_URL}/auth/v1/token*`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) });
    });
    await page.route(`${SUPABASE_URL}/auth/v1/user`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    });
    await page.route(`${SUPABASE_URL}/rest/v1/profiles*`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PROFILE]) });
    });
    await page.route(`${SUPABASE_URL}/rest/v1/**`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/login');
    await expect(page.getByPlaceholder('usuario@hospital.com')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('usuario@hospital.com').fill('admin@test.com');
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Should navigate away from /login
    await expect(page).not.toHaveURL('/login', { timeout: 8000 });
  });

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await mockUnauthenticated(page);

    await page.route(`${SUPABASE_URL}/auth/v1/token*`, route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    });

    await page.goto('/login');
    await expect(page.getByPlaceholder('usuario@hospital.com')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('usuario@hospital.com').fill('bad@test.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('usuario no autenticado redirige a /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});
