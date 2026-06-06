import { test, expect } from '@playwright/test';
import { MOCK_SURGERIES, MOCK_IMPLANTS } from './fixtures/mockData';
import { mockAuthenticatedSession, mockRestTable } from './fixtures/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockRestTable(page, 'surgeries', MOCK_SURGERIES);
    await mockRestTable(page, 'implants', MOCK_IMPLANTS);
    await mockRestTable(page, 'implant_lots', []);
    await mockRestTable(page, 'notifications', []);
  });

  test('carga y muestra heading Panel Principal', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /panel principal/i })).toBeVisible({ timeout: 10000 });
  });

  test('muestra tarjeta de inventario crítico', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /panel principal/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/inventario crítico/i)).toBeVisible({ timeout: 5000 });
  });

  test('muestra sección de alertas de inventario', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /panel principal/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /alertas de inventario/i })).toBeVisible({ timeout: 5000 });
  });

  test('cirugía reciente visible en lista', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /panel principal/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Juan Pérez')).toBeVisible({ timeout: 5000 });
  });
});
