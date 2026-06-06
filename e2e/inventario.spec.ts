import { test, expect } from '@playwright/test';
import { MOCK_IMPLANTS } from './fixtures/mockData';
import { mockAuthenticatedSession, mockRestTable } from './fixtures/auth';

test.describe('Inventario Quirúrgico', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockRestTable(page, 'implants', MOCK_IMPLANTS);
    await mockRestTable(page, 'implant_lots', []);
    await mockRestTable(page, 'trays', []);
  });

  test('carga y muestra lista de implantes', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Tornillo Tibial 6mm' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Placa de Titanio 3.5' })).toBeVisible({ timeout: 5000 });
  });

  test('muestra badge de stock crítico cuando no hay lotes', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Placa de Titanio 3.5' })).toBeVisible({ timeout: 5000 });
    // Sin lotes → "Sin Stock" (total=0 <= min_stock=8)
    await expect(page.getByText('Sin Stock').first()).toBeVisible({ timeout: 5000 });
  });

  test('abre formulario de nuevo producto', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    const newBtn = page.getByRole('button', { name: /nuevo producto/i });
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();
    await expect(page.getByPlaceholder(/nombre del implante/i)).toBeVisible({ timeout: 3000 });
  });

  test('formulario incluye campo stock mínimo', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await expect(page.getByLabel(/stock mínimo/i)).toBeVisible({ timeout: 3000 });
  });

  test('búsqueda filtra implantes por nombre', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Tornillo Tibial 6mm' })).toBeVisible({ timeout: 5000 });
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    await searchInput.fill('placa');
    await expect(page.getByRole('heading', { name: 'Placa de Titanio 3.5' })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('heading', { name: 'Tornillo Tibial 6mm' })).not.toBeVisible();
  });
});
