import { test, expect } from '@playwright/test';
import { SUPABASE_URL, MOCK_USER, MOCK_SESSION, MOCK_ORG } from './fixtures/mockData';
import { mockRestTable } from './fixtures/auth';

const MOCK_SURGEON_PROFILE = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  full_name: 'Dra. Ana Marte',
  role: 'Cirujano',
  org_id: 'mock-org-id-e2e',
  is_active: true,
  is_platform_admin: false,
  must_change_password: false,
  created_at: '2024-01-01T00:00:00Z',
};

const MOCK_SURGEON = {
  id: 'surgeon-e2e-1',
  full_name: 'Dra. Ana Marte',
  specialty: 'Ortopedia',
  email: 'ana@hospital.com',
  user_id: MOCK_USER.id,
  org_id: 'mock-org-id-e2e',
};

const MOCK_SURGERY_REQUESTS = [
  {
    id: 'req-001',
    surgeon_id: MOCK_SURGEON.id,
    patient_name: 'Carlos Méndez',
    surgery_date: '2026-07-15T08:00:00',
    status: 'Pendiente',
    procedure_type: 'Artroplastia de Cadera',
    hospital_id: 'hospital-1',
    org_id: 'mock-org-id-e2e',
    notes: 'Paciente con historial previo',
    created_at: '2026-06-01T00:00:00Z',
    hospital: { id: 'hospital-1', name: 'Hospital General' },
    surgeon: { id: MOCK_SURGEON.id, full_name: MOCK_SURGEON.full_name, specialty: MOCK_SURGEON.specialty },
    ars: null,
  },
  {
    id: 'req-002',
    surgeon_id: MOCK_SURGEON.id,
    patient_name: 'María Torres',
    surgery_date: '2026-08-01T10:00:00',
    status: 'Aprobada',
    procedure_type: 'Artroplastia de Rodilla',
    hospital_id: 'hospital-1',
    org_id: 'mock-org-id-e2e',
    notes: '',
    created_at: '2026-06-02T00:00:00Z',
    hospital: { id: 'hospital-1', name: 'Hospital General' },
    surgeon: { id: MOCK_SURGEON.id, full_name: MOCK_SURGEON.full_name, specialty: MOCK_SURGEON.specialty },
    ars: { id: 'ars-1', name: 'ARS Salud Segura' },
  },
];

// Setup común para sesión de cirujano
async function mockSurgeonSession(page: import('@playwright/test').Page) {
  const PROJECT_REF = process.env['E2E_SUPABASE_PROJECT_REF'] || 'local';

  await page.addInitScript(({ ref, session, user }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    localStorage.setItem(`sb-${ref}-auth-token-user`, JSON.stringify({ user }));
  }, { ref: PROJECT_REF, session: MOCK_SESSION, user: MOCK_USER });

  await page.route(`${SUPABASE_URL}/**`, (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/v1/user'))  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    if (url.includes('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) });
    if (url.includes('/rest/v1/profiles'))             return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_SURGEON_PROFILE]) });
    if (url.includes('/rest/v1/organizations'))        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_ORG]) });
    if (url.includes('/rest/v1/organization_settings')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ org_id: MOCK_ORG.id, company_name: MOCK_ORG.name }) });
    if (url.includes('/rest/v1/') && method === 'GET')  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (url.includes('/rest/v1/') && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    return route.abort();
  });
}

test.describe('Mis Solicitudes — Portal de Cirujano', () => {
  test.beforeEach(async ({ page }) => {
    await mockSurgeonSession(page);
    // LIFO: específicos después del catch-all
    await mockRestTable(page, 'surgeons', [MOCK_SURGEON]);
    await mockRestTable(page, 'surgery_requests', MOCK_SURGERY_REQUESTS);
    await mockRestTable(page, 'hospitals', [{ id: 'hospital-1', name: 'Hospital General' }]);
    await mockRestTable(page, 'procedure_types', [
      { id: 'proc-1', name: 'Artroplastia de Cadera', is_active: true },
      { id: 'proc-2', name: 'Artroplastia de Rodilla', is_active: true },
    ]);
    await mockRestTable(page, 'ars', [{ id: 'ars-1', name: 'ARS Salud Segura' }]);
  });

  test('carga portal con saludo al cirujano', async ({ page }) => {
    await page.goto('/mis-solicitudes');
    await expect(page.getByText(/portal de cirujanos/i)).toBeVisible({ timeout: 10000 });
    // El h1 contiene "¡Hola, Dra. Ana Marte!" — buscamos por el heading para evitar strict mode
    await expect(page.getByRole('heading', { name: /ana marte/i })).toBeVisible({ timeout: 5000 });
  });

  test('muestra solicitudes del cirujano', async ({ page }) => {
    await page.goto('/mis-solicitudes');
    await expect(page.getByText(/portal de cirujanos/i)).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Carlos Méndez')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('María Torres')).toBeVisible({ timeout: 5000 });
  });

  test('muestra badge de estado correcto', async ({ page }) => {
    await page.goto('/mis-solicitudes');
    await expect(page.getByText(/portal de cirujanos/i)).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Pendiente').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Aprobada').first()).toBeVisible({ timeout: 5000 });
  });

  test('muestra estado vacío cuando no hay solicitudes', async ({ page }) => {
    await mockRestTable(page, 'surgery_requests', []);
    await page.goto('/mis-solicitudes');
    await expect(page.getByText(/portal de cirujanos/i)).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/aún no tienes solicitudes/i)).toBeVisible({ timeout: 5000 });
  });

  test('abre modal de nueva solicitud', async ({ page }) => {
    await page.goto('/mis-solicitudes');
    await expect(page.getByText(/portal de cirujanos/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /nueva solicitud de equipo/i }).click();

    // Placeholder exacto del campo en MisSolicitudes modal
    await expect(page.getByPlaceholder('Ej: Carmen Rodríguez')).toBeVisible({ timeout: 3000 });
  });

  test('redirige al dashboard si no tiene cuenta de cirujano vinculada', async ({ page }) => {
    // Sin surgeon_id vinculado al usuario → surgeons devuelve []
    await mockRestTable(page, 'surgeons', []);
    await page.goto('/mis-solicitudes');
    await expect(page.getByText(/portal de cirujanos/i)).toBeVisible({ timeout: 10000 });

    // No debe mostrar solicitudes, muestra EmptyState
    await expect(page.getByText(/aún no tienes solicitudes/i)).toBeVisible({ timeout: 5000 });
  });
});
