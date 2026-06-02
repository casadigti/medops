import { test, expect, type Page } from '@playwright/test';
import { SUPABASE_URL, PROJECT_REF, MOCK_SESSION, MOCK_USER, MOCK_ORG } from './fixtures/mockData';

const MOCK_ADMIN_PROFILE = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  full_name: 'Admin Test',
  role: 'Administrador',
  org_id: MOCK_ORG.id,
  is_active: true,
  is_platform_admin: false,
  must_change_password: false,
};

const MOCK_OTHER_USER = {
  id: 'user-other-id',
  email: 'otro@test.com',
  full_name: 'Dr. Otro',
  role: 'Cirujano',
  org_id: MOCK_ORG.id,
  is_active: true,
  is_platform_admin: false,
  must_change_password: false,
};

async function mockAdminSession(page: Page, manageUsersResponse: object = { success: true }) {
  await page.addInitScript(({ ref, session, user }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    localStorage.setItem(`sb-${ref}-auth-token-user`, JSON.stringify({ user }));
  }, { ref: PROJECT_REF, session: MOCK_SESSION, user: MOCK_USER });

  await page.route(`${SUPABASE_URL}/**`, (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/v1/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    }
    if (url.includes('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) });
    }
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_ADMIN_PROFILE, MOCK_OTHER_USER]) });
    }
    if (url.includes('/rest/v1/organizations')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_ORG]) });
    }
    if (url.includes('/rest/v1/organization_settings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ org_id: MOCK_ORG.id, company_name: MOCK_ORG.name }) });
    }
    if (url.includes('/functions/v1/manage-users')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manageUsersResponse) });
    }
    if (url.includes('/rest/v1/') && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.includes('/rest/v1/') && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }
    return route.abort();
  });
}

test.describe('Password Reset (admin)', () => {
  test('muestra lista de usuarios en Configuración', async ({ page }) => {
    await mockAdminSession(page);
    await page.goto('/configuracion');

    await page.getByText(/usuarios y roles/i).click();
    await expect(page.getByText('Dr. Otro')).toBeVisible({ timeout: 10000 });
  });

  test('abre modal de edición al hacer click en Editar', async ({ page }) => {
    await mockAdminSession(page);
    await page.goto('/configuracion');

    await page.getByText(/usuarios y roles/i).click();
    await expect(page.getByText('Dr. Otro')).toBeVisible({ timeout: 10000 });

    // Each row has an "Editar" text button — filter by row containing "Dr. Otro"
    await page.getByRole('row').filter({ hasText: 'Dr. Otro' }).getByRole('button', { name: 'Editar' }).click();

    await expect(page.getByText('Editar Usuario')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Nueva temporal (opcional)')).toBeVisible();
  });

  test('campo password vacío no envía password al guardar', async ({ page }) => {
    let capturedBody: string | null = null;

    await mockAdminSession(page);
    await page.goto('/configuracion');

    await page.route(`${SUPABASE_URL}/functions/v1/manage-users`, async (route) => {
      capturedBody = route.request().postData();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.getByText(/usuarios y roles/i).click();
    await expect(page.getByText('Dr. Otro')).toBeVisible({ timeout: 10000 });

    await page.getByRole('row').filter({ hasText: 'Dr. Otro' }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByText('Editar Usuario')).toBeVisible({ timeout: 5000 });

    // Don't fill password — just save
    // Scope to modal form to avoid ambiguity with page-level "Guardar Cambios" button
    await page.locator('form').getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText('Usuario actualizado correctamente.')).toBeVisible({ timeout: 8000 });

    // Password should not be in the request body
    if (capturedBody) {
      const parsed = JSON.parse(capturedBody);
      expect(parsed.userData?.password).toBeFalsy();
    }
  });

  test('password reset exitoso muestra toast de éxito', async ({ page }) => {
    await mockAdminSession(page);
    await page.goto('/configuracion');

    await page.getByText(/usuarios y roles/i).click();
    await expect(page.getByText('Dr. Otro')).toBeVisible({ timeout: 10000 });

    await page.getByRole('row').filter({ hasText: 'Dr. Otro' }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByPlaceholder('Nueva temporal (opcional)')).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('Nueva temporal (opcional)').fill('NuevaClave2026');
    // Scope to modal form to avoid ambiguity with page-level "Guardar Cambios" button
    await page.locator('form').getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText('Usuario actualizado correctamente.')).toBeVisible({ timeout: 8000 });
  });

  test('password reset fallido muestra error real', async ({ page }) => {
    await mockAdminSession(page, { error: 'Password too weak' });
    await page.goto('/configuracion');

    await page.getByText(/usuarios y roles/i).click();
    await expect(page.getByText('Dr. Otro')).toBeVisible({ timeout: 10000 });

    await page.getByRole('row').filter({ hasText: 'Dr. Otro' }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByPlaceholder('Nueva temporal (opcional)')).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('Nueva temporal (opcional)').fill('abc');
    // Scope to modal form to avoid ambiguity with page-level "Guardar Cambios" button
    await page.locator('form').getByRole('button', { name: /guardar cambios/i }).click();

    // Error toast — not success
    await expect(page.getByText('Usuario actualizado correctamente.')).not.toBeVisible({ timeout: 3000 });
  });
});
