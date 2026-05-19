import { Page } from '@playwright/test';
import {
  SUPABASE_URL, PROJECT_REF,
  MOCK_SESSION, MOCK_USER, MOCK_PROFILE,
} from './mockData';

/**
 * Sets up a fully mocked authenticated session.
 * - Injects mock session into localStorage before page JS runs
 * - Mocks all Supabase HTTP endpoints
 * Call this before page.goto().
 */
export async function mockAuthenticatedSession(page: Page) {
  // Inject session into localStorage before app scripts run
  await page.addInitScript(({ ref, session }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
  }, { ref: PROJECT_REF, session: MOCK_SESSION });

  // Single catch-all route for ALL Supabase calls
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PROFILE]) });
    }
    if (url.includes('/rest/v1/') && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.includes('/rest/v1/') && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }
    // Abort realtime / everything else
    return route.abort();
  });
}

/**
 * Sets up an unauthenticated state.
 * - Clears localStorage session
 * - Mocks Supabase auth to return 401 so app redirects to /login
 */
export async function mockUnauthenticated(page: Page) {
  await page.addInitScript(({ ref }) => {
    localStorage.removeItem(`sb-${ref}-auth-token`);
  }, { ref: PROJECT_REF });

  await page.route(`${SUPABASE_URL}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not authenticated' }) });
    }
    return route.abort();
  });
}

/** Override specific REST table with custom response, after mockAuthenticatedSession */
export async function mockRestTable(page: Page, table: string, data: unknown) {
  await page.route(`${SUPABASE_URL}/rest/v1/${table}*`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
}
