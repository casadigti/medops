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

  test('carga y muestra métricas principales', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    // Métricas de cirugías deben estar visibles
    await expect(page.getByText(/cirugías/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('muestra tarjeta de inventario crítico', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/inventario crítico/i)).toBeVisible({ timeout: 5000 });
  });

  test('muestra alerta de stock bajo para Placa de Titanio', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    // Placa de Titanio 3.5: stock=2 < min_stock=8 → debe aparecer en alertas
    await expect(page.getByText('Placa de Titanio 3.5')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/mínimo requerido/i)).toBeVisible({ timeout: 5000 });
  });

  test('botón de recarga visible y funcional', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    const reloadBtn = page.getByRole('button', { name: /recargar/i });
    await expect(reloadBtn).toBeVisible({ timeout: 5000 });
    await reloadBtn.click();
    // Tras reload, dashboard sigue visible
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 5000 });
  });

  test('cirugía reciente visible en lista', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Juan Pérez')).toBeVisible({ timeout: 5000 });
  });
});
