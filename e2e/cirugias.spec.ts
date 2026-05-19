import { test, expect } from '@playwright/test';
import { MOCK_SURGERIES, MOCK_HOSPITALS, MOCK_SURGEONS, MOCK_ARS } from './fixtures/mockData';
import { mockAuthenticatedSession, mockRestTable } from './fixtures/auth';

test.describe('Cirugías', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockRestTable(page, 'surgeries', MOCK_SURGERIES);
    await mockRestTable(page, 'hospitals', MOCK_HOSPITALS);
    await mockRestTable(page, 'surgeons', MOCK_SURGEONS);
    await mockRestTable(page, 'ars', MOCK_ARS);
  });

  test('carga y muestra lista de cirugías', async ({ page }) => {
    await page.goto('/cirugias');

    // Wait for app to finish loading auth and render page heading
    await expect(page.getByRole('heading', { name: /gestión de cirugías/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Juan Pérez')).toBeVisible({ timeout: 5000 });
  });

  test('abre formulario de nueva cirugía', async ({ page }) => {
    await page.goto('/cirugias');
    await expect(page.getByRole('heading', { name: /gestión de cirugías/i })).toBeVisible({ timeout: 10000 });

    const newBtn = page.getByRole('button', { name: /nueva cirugía/i });
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();

    // Modal with patient name input should open
    await expect(
      page.getByPlaceholder('Nombre completo del paciente')
    ).toBeVisible({ timeout: 3000 });
  });

  test('crea una cirugía con datos válidos', async ({ page }) => {
    await page.goto('/cirugias');
    await expect(page.getByRole('heading', { name: /gestión de cirugías/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /nueva cirugía/i }).click();

    const patientInput = page.getByPlaceholder('Nombre completo del paciente');
    await expect(patientInput).toBeVisible({ timeout: 3000 });
    await patientInput.fill('María García');

    // Fill datetime-local using native setter so React synthetic event fires
    await page.locator('input[type="datetime-local"], input[type="date"]').first().evaluate(
      (el: HTMLInputElement) => {
        const value = el.type === 'datetime-local' ? '2026-06-01T09:00' : '2026-06-01';
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    );

    // Select ARS (first non-empty option)
    await page.locator('select').filter({ hasText: 'Seleccionar ARS' }).selectOption({ index: 1 });

    // Select procedure type (first non-empty option)
    await page.locator('select').filter({ hasText: 'Seleccionar procedimiento' }).selectOption({ index: 1 });

    // Submit
    await page.getByRole('button', { name: /crear cirugía|guardar|confirmar/i }).click();

    // Modal should close — patient input no longer visible
    await expect(patientInput).not.toBeVisible({ timeout: 5000 });
  });
});
