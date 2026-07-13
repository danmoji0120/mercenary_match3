import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', timeout: 35_000, expect: { timeout: 8_000 }, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium-mobile', use: { ...devices['Pixel 5'] } }],
  webServer: {
    command: 'npm run dev', url: 'http://127.0.0.1:5173', timeout: 120_000, reuseExistingServer: false,
    env: { ENABLE_TEST_API: 'true', ACCOUNT_TEST_MODE: 'true', VITE_ACCOUNT_TEST_MODE: 'true', COUNTDOWN_MS: '100', QUEUE_BOT_DELAY_MS: '60000', CLIENT_ORIGIN: 'http://127.0.0.1:5173', VITE_SERVER_URL: 'http://127.0.0.1:3001' },
  },
});
