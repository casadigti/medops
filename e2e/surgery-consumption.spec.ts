import { test, expect } from '@playwright/test';
import { mockAuthenticatedSession, mockRestTable } from './fixtures/auth';
import { MOCK_SURGERIES, MOCK_HOSPITALS, MOCK_SURGEONS, MOCK_ARS, MOCK_PROCEDURE_TYPES, SUPABASE_URL } from './fixtures/mockData';

const MOCK_IMPLANT_LOTS = [
  {
    id: 'lot-1',
    implant_id: 'imp-1',
    lot_number: 'LP-01',
    expiration_date: '2027-12-31',
    current_quantity: 10,
    implants: { id: 'imp-1', name: 'Placa LCP', sku: 'PLC-LCP-4', unit_cost: 1200 },
  },
];

// Implants must include embedded lots for ConsumptionForm's availableLots calculation
const MOCK_IMPLANTS = [
  {
    id: 'imp-1', name: 'Placa LCP', sku: 'PLC-LCP-4', category: 'Placas',
    unit_cost: 1200, selling_price: 2500, min_stock: 5,
    implant_lots: MOCK_IMPLANT_LOTS,
  },
];

const SURGERY_IN_PROGRESS = {
  ...MOCK_SURGERIES[0],
  id: 'surgery-active',
  patient_name: 'Rosa Martínez',
  status: 'Completada',   // consumo solo disponible en Completada
  surgery_consumptions: [],
  surgery_trays: [],
};

test.describe('Consumo de Cirugía', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockRestTable(page, 'surgeries', [SURGERY_IN_PROGRESS]);
    await mockRestTable(page, 'hospitals', MOCK_HOSPITALS);
    await mockRestTable(page, 'surgeons', MOCK_SURGEONS);
    await mockRestTable(page, 'ars', MOCK_ARS);
    await mockRestTable(page, 'procedure_types', MOCK_PROCEDURE_TYPES);
    await mockRestTable(page, 'implants', MOCK_IMPLANTS);
    await mockRestTable(page, 'implant_lots', MOCK_IMPLANT_LOTS);
  });

  test('muestra cirugía con estado Completada', async ({ page }) => {
    await page.goto('/cirugias');

    await expect(page.getByRole('heading', { name: /gestión de cirugías/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Rosa Martínez')).toBeVisible({ timeout: 5000 });
    // Consumption button enabled only when status = Completada — proves status without ambiguous text selector
    await expect(page.getByTitle('Reportar Gasto Quirúrgico')).toBeEnabled({ timeout: 5000 });
  });

  test('botón reportar gasto visible y habilitado en cirugía Completada', async ({ page }) => {
    await page.goto('/cirugias');

    await expect(page.getByText('Rosa Martínez')).toBeVisible({ timeout: 10000 });

    // Consumption button has title "Reportar Gasto Quirúrgico" when status = Completada
    const consumoBtn = page.getByTitle('Reportar Gasto Quirúrgico');
    await expect(consumoBtn).toBeVisible({ timeout: 5000 });
    await expect(consumoBtn).toBeEnabled();
  });

  test('abre modal de consumo al hacer click en Reportar Gasto', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/rest/v1/implant_lots*`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_IMPLANT_LOTS),
      });
    });

    await page.goto('/cirugias');
    await expect(page.getByText('Rosa Martínez')).toBeVisible({ timeout: 10000 });

    await page.getByTitle('Reportar Gasto Quirúrgico').click();

    // Modal opens with title "Reportar Gasto: Rosa Martínez"
    await expect(page.getByText(/Reportar Gasto.*Rosa/i)).toBeVisible({ timeout: 5000 });
  });

  test('registrar consumo exitoso muestra confirmación', async ({ page }) => {
    let consumptionSaved = false;

    await page.route(`${SUPABASE_URL}/rest/v1/surgery_consumption*`, (route) => {
      if (route.request().method() === 'POST') {
        consumptionSaved = true;
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'cons-1' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route(`${SUPABASE_URL}/rest/v1/implant_lots*`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_IMPLANT_LOTS),
      });
    });

    await page.goto('/cirugias');
    await expect(page.getByText('Rosa Martínez')).toBeVisible({ timeout: 10000 });

    // Button title when surgery is Completada
    await page.getByTitle('Reportar Gasto Quirúrgico').click();

    // Modal opens with title "Reportar Gasto: Rosa Martínez"
    await expect(page.getByText(/Reportar Gasto.*Rosa/i)).toBeVisible({ timeout: 5000 });

    // Scope selects to the consumption form section (h4 "Registrar Nuevo Gasto")
    // to avoid matching page-level filter dropdowns
    const consumptionForm = page.locator('h4').filter({ hasText: /Registrar Nuevo Gasto/i })
      .locator('..').locator('..');

    // Step 1: Select product (implant)
    await consumptionForm.locator('select').first().selectOption('imp-1');

    // Step 2: Select lot (enabled after product selected)
    await consumptionForm.locator('select').nth(1).selectOption('lot-1');

    // Submit — exact "Cargar" to avoid matching "Descargar Acta" button
    await consumptionForm.getByRole('button', { name: 'Cargar', exact: true }).click();

    // Success toast — exact text from handleConsumptionReport
    await expect(page.getByText('Gasto registrado y stock actualizado')).toBeVisible({ timeout: 8000 });
  });

  test('consumo muestra implante registrado en lista de la cirugía', async ({ page }) => {
    const surgeryWithConsumption = {
      ...SURGERY_IN_PROGRESS,
      // Field name is surgery_consumption (singular) as used in the component
      surgery_consumption: [
        {
          id: 'cons-1',
          surgery_id: 'surgery-active',
          implant_lot_id: 'lot-1',
          quantity_used: 1,
          auth_number: '7575757',
          implant_lots: {
            id: 'lot-1',
            lot_number: 'LP-01',
            implants: { name: 'Placa LCP', sku: 'PLC-LCP-4', unit_cost: 1200 },
          },
        },
      ],
    };

    await mockRestTable(page, 'surgeries', [surgeryWithConsumption]);
    await page.goto('/cirugias');

    await expect(page.getByText('Rosa Martínez')).toBeVisible({ timeout: 10000 });

    // Click the consumption icon button to open the consumption view panel
    await page.getByTitle('Reportar Gasto Quirúrgico').click();

    // Consumption items appear in the modal — avoid hidden <option> elements
    await expect(page.locator('p, span, td, div').filter({ hasText: /placa lcp/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
