import { test, expect } from '@playwright/test';
import { MOCK_HOSPITALS, MOCK_ARS, MOCK_PROCEDURE_TYPES } from './fixtures/mockData';
import { mockAuthenticatedSession, mockRestTable } from './fixtures/auth';

const MOCK_SURGEONS_ADMIN = [
  { id: 'surgeon-a1', full_name: 'Dr. García López', specialty: 'Ortopedia', email: 'garcia@h.com', user_id: null },
  { id: 'surgeon-a2', full_name: 'Dra. Pérez Soto', specialty: 'Traumatología', email: 'perez@h.com', user_id: null },
];

const MOCK_REQUESTS = [
  {
    id: 'req-a001',
    surgeon_id: 'surgeon-a1',
    patient_name: 'Pedro Rodríguez',
    surgery_date: '2026-07-10T09:00:00',
    status: 'Pendiente',
    procedure_type: 'Artroplastia de Cadera',
    hospital_id: 'hospital-1',
    org_id: 'mock-org-id-e2e',
    notes: '',
    admin_notes: null,
    created_at: '2026-06-01T00:00:00Z',
    hospital: { id: 'hospital-1', name: 'Hospital General' },
    surgeon: { id: 'surgeon-a1', full_name: 'Dr. García López', specialty: 'Ortopedia' },
    ars: { id: 'ars-1', name: 'ARS Salud Segura' },
  },
  {
    id: 'req-a002',
    surgeon_id: 'surgeon-a2',
    patient_name: 'Laura Jiménez',
    surgery_date: '2026-07-20T08:00:00',
    status: 'Aprobada',
    procedure_type: 'Artroplastia de Rodilla',
    hospital_id: 'hospital-1',
    org_id: 'mock-org-id-e2e',
    notes: 'Urgente',
    admin_notes: 'Aprobado sin observaciones',
    created_at: '2026-06-02T00:00:00Z',
    hospital: { id: 'hospital-1', name: 'Hospital General' },
    surgeon: { id: 'surgeon-a2', full_name: 'Dra. Pérez Soto', specialty: 'Traumatología' },
    ars: null,
  },
  {
    id: 'req-a003',
    surgeon_id: 'surgeon-a1',
    patient_name: 'Miguel Santos',
    surgery_date: '2026-07-25T11:00:00',
    status: 'Rechazada',
    procedure_type: 'Artroplastia de Cadera',
    hospital_id: 'hospital-1',
    org_id: 'mock-org-id-e2e',
    notes: '',
    admin_notes: 'Documentación incompleta',
    created_at: '2026-06-03T00:00:00Z',
    hospital: { id: 'hospital-1', name: 'Hospital General' },
    surgeon: { id: 'surgeon-a1', full_name: 'Dr. García López', specialty: 'Ortopedia' },
    ars: null,
  },
];

test.describe('Solicitudes Admin', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockRestTable(page, 'surgery_requests', MOCK_REQUESTS);
    await mockRestTable(page, 'surgeons', MOCK_SURGEONS_ADMIN);
    await mockRestTable(page, 'hospitals', MOCK_HOSPITALS);
    await mockRestTable(page, 'ars', MOCK_ARS);
    await mockRestTable(page, 'procedure_types', MOCK_PROCEDURE_TYPES);
  });

  test('carga página con heading correcto', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });
  });

  test('muestra estadísticas correctas', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    // Total: 3, Pendientes: 1, Aprobadas: 1, Rechazadas: 1
    const cards = page.locator('.rounded-2xl.p-5');
    await expect(cards.filter({ hasText: 'Total' })).toContainText('3', { timeout: 5000 });
    await expect(cards.filter({ hasText: 'Pendientes' })).toContainText('1');
    await expect(cards.filter({ hasText: 'Aprobadas' })).toContainText('1');
    await expect(cards.filter({ hasText: 'Rechazadas' })).toContainText('1');
  });

  test('muestra lista de solicitudes en tabla', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Pedro Rodríguez')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Laura Jiménez')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Miguel Santos')).toBeVisible({ timeout: 5000 });
  });

  test('botón Aprobar visible solo en solicitudes Pendiente', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    // Solo req-a001 (Pendiente) debe tener botón Aprobar
    const approveButtons = page.getByRole('button', { name: /aprobar/i });
    await expect(approveButtons).toHaveCount(1, { timeout: 5000 });
  });

  test('botón Rechazar visible solo en solicitudes Pendiente', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    const rejectButtons = page.getByRole('button', { name: /rechazar/i });
    await expect(rejectButtons).toHaveCount(1, { timeout: 5000 });
  });

  test('abre modal de rechazo al hacer clic en Rechazar', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /rechazar/i }).first().click();

    // Placeholder exacto del textarea — el label no tiene htmlFor asociado
    await expect(page.getByPlaceholder('Ej: Equipo no disponible para esa fecha...')).toBeVisible({ timeout: 3000 });
  });

  test('filtro de búsqueda por texto filtra resultados', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Pedro Rodríguez')).toBeVisible({ timeout: 5000 });

    // Placeholder exacto del filtro — evita conflicto con el buscador del Layout
    await page.getByPlaceholder('Buscar paciente, cirujano, procedimiento...').fill('Laura');

    await expect(page.getByText('Laura Jiménez')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Pedro Rodríguez')).not.toBeVisible();
    await expect(page.getByText('Miguel Santos')).not.toBeVisible();
  });

  test('filtro de estado muestra solo Pendientes', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Pedro Rodríguez')).toBeVisible({ timeout: 5000 });

    await page.locator('select').filter({ hasText: /todos los estados/i }).selectOption('Pendiente');

    await expect(page.getByText('Pedro Rodríguez')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Laura Jiménez')).not.toBeVisible();
    await expect(page.getByText('Miguel Santos')).not.toBeVisible();
  });

  test('botón limpiar filtros aparece y resetea búsqueda', async ({ page }) => {
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    // Placeholder exacto del filtro — evita conflicto con el buscador del Layout
    await page.getByPlaceholder('Buscar paciente, cirujano, procedimiento...').fill('Laura');
    await expect(page.getByText(/limpiar filtros/i)).toBeVisible({ timeout: 3000 });

    await page.getByText(/limpiar filtros/i).click();

    await expect(page.getByText('Pedro Rodríguez')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Miguel Santos')).toBeVisible();
  });

  test('estado vacío cuando no hay solicitudes', async ({ page }) => {
    await mockRestTable(page, 'surgery_requests', []);
    await page.goto('/solicitudes-admin');
    await expect(page.getByRole('heading', { name: /solicitudes de cirujanos/i })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/sin solicitudes que coincidan/i)).toBeVisible({ timeout: 5000 });
  });
});
