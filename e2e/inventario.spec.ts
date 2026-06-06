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
    await expect(page.getByText('Tornillo Tibial 6mm')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Placa de Titanio 3.5')).toBeVisible({ timeout: 5000 });
  });

  test('muestra badge Stock Bajo cuando stock < min_stock', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    // Placa de Titanio: current_quantity=2 < min_stock=8 → debe mostrar badge
    await expect(page.getByText('Placa de Titanio 3.5')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Stock Bajo')).toBeVisible({ timeout: 5000 });
  });

  test('abre formulario de nuevo implante', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    const newBtn = page.getByRole('button', { name: /nuevo implante/i });
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();
    await expect(page.getByPlaceholder(/nombre del implante/i)).toBeVisible({ timeout: 3000 });
  });

  test('formulario de implante incluye campo stock mínimo', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /nuevo implante/i }).click();
    // Campo min_stock debe estar visible en el formulario
    await expect(page.getByLabel(/stock mínimo/i)).toBeVisible({ timeout: 3000 });
  });

  test('búsqueda filtra implantes por nombre', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('heading', { name: /inventario quirúrgico/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tornillo Tibial 6mm')).toBeVisible({ timeout: 5000 });

    const searchInput = page.getByPlaceholder(/buscar/i).first();
    await searchInput.fill('placa');
    await expect(page.getByText('Placa de Titanio 3.5')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Tornillo Tibial 6mm')).not.toBeVisible();
  });
});
