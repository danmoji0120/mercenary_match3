import { defineConfig, devices } from '@playwright/test';

const port = 4187;
export default defineConfig({
  testDir: './tests/production', timeout: 30_000, expect: { timeout: 8_000 }, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'production-chromium-mobile', use: { ...devices['Pixel 5'] } }],
  webServer: { command: 'npm run start', url: `http://127.0.0.1:${port}/health`, timeout: 30_000, reuseExistingServer: false, env: { NODE_ENV: 'production', PORT: String(port), CLIENT_ORIGIN: '', ENABLE_TEST_API: 'true', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-placeholder' } },
});
