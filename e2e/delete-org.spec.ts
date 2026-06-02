import { test, expect, type Page } from '@playwright/test';
import { SUPABASE_URL, PROJECT_REF, MOCK_SESSION, MOCK_USER } from './fixtures/mockData';

const MOCK_ORG_A = { id: 'org-a', name: 'Organización Principal', slug: 'org-a', is_active: true, max_users: 20, created_at: '2024-01-01T00:00:00Z' };
const MOCK_ORG_B = { id: 'org-b', name: 'Org a Eliminar', slug: 'org-b', is_active: true, max_users: 20, created_at: '2024-02-01T00:00:00Z' };

const MOCK_SUPERADMIN_PROFILE = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  full_name: 'Admin Test',
  role: 'Superadmin',
  org_id: 'org-a',
  is_active: true,
  is_platform_admin: true,
  must_change_password: false,
};

async function mockSuperadminSession(page: Page) {
  await page.addInitScript(({ ref, session, user }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    localStorage.setItem(`sb-${ref}-auth-token-user`, JSON.stringify({ user }));
  }, { ref: PROJECT_REF, session: MOCK_SESSION, user: MOCK_USER });

  let orgs = [MOCK_ORG_A, MOCK_ORG_B];

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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_SUPERADMIN_PROFILE]) });
    }
    if (url.includes('/rest/v1/organizations')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orgs) });
    }
    if (url.includes('/rest/v1/organization_settings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ org_id: 'org-a', company_name: 'Organización Principal' }) });
    }
    if (url.includes('/functions/v1/manage-orgs')) {
      // Simulate successful delete — remove org-b from list
      orgs = orgs.filter(o => o.id !== 'org-b');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, orgId: 'org-b' }) });
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

test.describe('Delete Org', () => {
  test('muestra ambas orgs en lista', async ({ page }) => {
    await mockSuperadminSession(page);
    await page.goto('/organizaciones');

    await expect(page.getByText('Organización Principal')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Org a Eliminar')).toBeVisible({ timeout: 5000 });
  });

  test('botón eliminar disponible para platform admin', async ({ page }) => {
    await mockSuperadminSession(page);
    await page.goto('/organizaciones');

    await expect(page.getByText('Org a Eliminar')).toBeVisible({ timeout: 10000 });
    // Trash icon button should be present for each org
    const deleteButtons = page.locator('button[title*="liminar"], button svg[data-lucide="trash-2"]').first();
    await expect(deleteButtons).toBeVisible({ timeout: 5000 });
  });

  test('abre modal de confirmación al hacer click en eliminar', async ({ page }) => {
    await mockSuperadminSession(page);
    await page.goto('/organizaciones');

    await expect(page.getByText('Org a Eliminar')).toBeVisible({ timeout: 10000 });

    // Click trash icon by title
    await page.getByTitle('Eliminar organización permanentemente').last().click();

    // Confirm dialog should appear
    await expect(page.getByText(/Esta acción es permanente e irreversible/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Escribe/i)).toBeVisible();
  });

  test('eliminar org requiere escribir nombre exacto para habilitar botón', async ({ page }) => {
    await mockSuperadminSession(page);
    await page.goto('/organizaciones');

    await expect(page.getByText('Org a Eliminar')).toBeVisible({ timeout: 10000 });

    await page.getByTitle('Eliminar organización permanentemente').last().click();

    await expect(page.getByText(/Esta acción es permanente/i)).toBeVisible({ timeout: 5000 });

    const confirmBtn = page.getByRole('button', { name: /eliminar definitivamente/i });
    // Button disabled until name typed
    await expect(confirmBtn).toBeDisabled();

    // Type wrong name — still disabled
    await page.getByPlaceholder('Org a Eliminar').fill('nombre incorrecto');
    await expect(confirmBtn).toBeDisabled();

    // Type correct name — enabled
    await page.getByPlaceholder('Org a Eliminar').fill('Org a Eliminar');
    await expect(confirmBtn).toBeEnabled();
  });

  test('eliminar org exitoso muestra toast y remueve org de lista', async ({ page }) => {
    await mockSuperadminSession(page);
    await page.goto('/organizaciones');

    await expect(page.getByText('Org a Eliminar')).toBeVisible({ timeout: 10000 });

    await page.getByTitle('Eliminar organización permanentemente').last().click();

    await expect(page.getByText(/Esta acción es permanente/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Org a Eliminar').fill('Org a Eliminar');
    await page.getByRole('button', { name: /eliminar definitivamente/i }).click();

    // Toast success
    await expect(page.getByText(/eliminada permanentemente/i)).toBeVisible({ timeout: 8000 });
    // Org disappears from list
    await expect(page.getByText('Org a Eliminar')).not.toBeVisible({ timeout: 5000 });
  });
});
