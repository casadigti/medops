import { test, expect } from '@playwright/test';
import { mockAuthenticatedSession, mockRestTable } from './fixtures/auth';

const MOCK_SHELVES = [
  {
    id: 'shelf-1',
    name: 'Bloque A',
    orientation: 'horizontal',
    rows: 2,
    cols: 3,
    color: '#6366f1',
    description: 'Implantes Cadera',
    org_id: 'mock-org-id-e2e',
    created_at: '2026-05-01T00:00:00Z',
  },
];

const MOCK_SLOTS = [
  { id: 'slot-A1', shelf_id: 'shelf-1', row_index: 0, col_index: 0, item_type: null, item_id: null },
  { id: 'slot-A2', shelf_id: 'shelf-1', row_index: 0, col_index: 1, item_type: null, item_id: null },
  { id: 'slot-A3', shelf_id: 'shelf-1', row_index: 0, col_index: 2, item_type: null, item_id: null },
  { id: 'slot-B1', shelf_id: 'shelf-1', row_index: 1, col_index: 0, item_type: null, item_id: null },
  { id: 'slot-B2', shelf_id: 'shelf-1', row_index: 1, col_index: 1, item_type: null, item_id: null },
  { id: 'slot-B3', shelf_id: 'shelf-1', row_index: 1, col_index: 2, item_type: null, item_id: null },
];

test.describe('Mapa de Almacén', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.route(/\/rest\/v1\/storage_shelves/, route => {
      const shelves = MOCK_SHELVES.map(s => ({ ...s, storage_slots: MOCK_SLOTS }));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shelves) });
    });
    await mockRestTable(page, 'implant_lots', []);
    await mockRestTable(page, 'storage_slots', MOCK_SLOTS);
  });

  test('muestra título Mapa de Almacén', async ({ page }) => {
    await page.goto('/almacen');
    await expect(page.getByRole('heading', { name: /mapa de almacén/i })).toBeVisible({ timeout: 10000 });
  });

  test('muestra nombre de estantería y dimensiones', async ({ page }) => {
    await page.goto('/almacen');
    await expect(page.getByText('Bloque A')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/2 filas/i)).toBeVisible();
  });

  test('muestra celdas A1 y B3', async ({ page }) => {
    await page.goto('/almacen');
    await expect(page.getByText('A1').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('B3').first()).toBeVisible();
  });

  test('buscador de mapa visible', async ({ page }) => {
    await page.goto('/almacen');
    await expect(page.getByPlaceholder(/buscar producto/i)).toBeVisible({ timeout: 8000 });
  });

  test('botón Nueva Estantería visible para admin', async ({ page }) => {
    await page.goto('/almacen');
    await expect(page.getByRole('button', { name: /nueva estantería/i })).toBeVisible({ timeout: 8000 });
  });

  test('leyenda de colores visible', async ({ page }) => {
    await page.goto('/almacen');
    await expect(page.getByText('Vacío')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Lote de implante')).toBeVisible();
    await expect(page.getByText('Bandeja')).toBeVisible();
  });
});
