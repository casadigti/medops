import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'fs';

// Leer .env manualmente para que los mocks apunten al mismo Supabase que la app
function loadEnv(): Record<string, string> {
  // Vite loads .env then .env.local (local overrides). Mirror that here.
  const result: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    try {
      const lines = readFileSync(file, 'utf-8')
        .split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'));
      for (const l of lines) {
        const [k, ...v] = l.split('=');
        result[k.trim()] = v.join('=').trim();
      }
    } catch { /* file may not exist */ }
  }
  return result;
}
const env = loadEnv();
const supabaseUrl = env['VITE_SUPABASE_URL'] ?? 'http://localhost:54321';
const projectRef  = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'local';
process.env['E2E_SUPABASE_URL']         ??= supabaseUrl;
process.env['E2E_SUPABASE_PROJECT_REF'] ??= projectRef;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx vite --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
