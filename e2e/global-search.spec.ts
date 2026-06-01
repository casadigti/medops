import { test, expect, type Page } from '@playwright/test';
import { mockAuthenticatedSession } from './fixtures/auth';

const MOCK_IMPLANTS = [
  { id: 'imp-1', name: 'Tornillo 3.5mm', sku: 'TOR-3.5-CAN', category: 'Tornillo' },
];
const MOCK_SURGERIES_SEARCH = [
  { id: 'surg-1', patient_name: 'Nancy Ogando', status: 'Pendiente', surgery_date: '2026-06-01' },
];

// Regex-based mock — works regardless of SUPABASE_URL base in env
async function mockTable(page: Page, table: string, data: unknown) {
  await page.route(new RegExp(`/rest/v1/${table}`), route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
}

test.describe('Búsqueda global', () => {
  test('visible en Dashboard', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.goto('/');
    await expect(page.getByPlaceholder(/buscar paciente/i)).toBeVisible({ timeout: 10000 });
  });

  test('oculto en /inventario', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.goto('/inventario');
    await expect(page.getByPlaceholder(/buscar paciente/i)).not.toBeVisible({ timeout: 8000 });
  });

  test('oculto en /bandejas', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.goto('/bandejas');
    await expect(page.getByPlaceholder(/buscar paciente/i)).not.toBeVisible({ timeout: 8000 });
  });

  test('muestra dropdown con resultados al escribir', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockTable(page, 'implants', MOCK_IMPLANTS);
    await mockTable(page, 'surgeries', MOCK_SURGERIES_SEARCH);
    await mockTable(page, 'trays', []);
    await page.goto('/');

    const input = page.getByPlaceholder(/buscar paciente/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('nancy');
    const dropdown = page.getByTestId('global-search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await expect(dropdown.getByText('Nancy Ogando')).toBeVisible();
  });

  test('navega a /cirugias al hacer clic en resultado de cirugía', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockTable(page, 'surgeries', MOCK_SURGERIES_SEARCH);
    await mockTable(page, 'implants', []);
    await mockTable(page, 'trays', []);
    await page.goto('/');

    await page.getByPlaceholder(/buscar paciente/i).fill('nancy');
    const dropdown = page.getByTestId('global-search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await dropdown.getByText('Nancy Ogando').click();
    await expect(page).toHaveURL(/\/cirugias(\?q=.+)?/, { timeout: 5000 });
  });

  test('Escape cierra dropdown y limpia input', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockTable(page, 'surgeries', MOCK_SURGERIES_SEARCH);
    await mockTable(page, 'implants', []);
    await mockTable(page, 'trays', []);
    await page.goto('/');

    const input = page.getByPlaceholder(/buscar paciente/i);
    await input.fill('nancy');
    const dropdown = page.getByTestId('global-search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await input.press('Escape');
    await expect(dropdown).not.toBeVisible();
    await expect(input).toHaveValue('');
  });
});
