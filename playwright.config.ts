import { defineConfig, devices } from '@playwright/test';

const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 5173);
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 3001);
const clientOrigin = `http://127.0.0.1:${clientPort}`;

export default defineConfig({
  testDir: './tests/e2e', timeout: 35_000, expect: { timeout: 8_000 }, fullyParallel: false, workers: 1,
  use: { baseURL: clientOrigin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium-mobile', use: { ...devices['Pixel 5'] } }],
  webServer: {
    command: `npx concurrently -k -n server,client "npm run dev -w @mercenary/server" "npm run dev -w @mercenary/client -- --port ${clientPort} --strictPort"`, url: clientOrigin, timeout: 120_000, reuseExistingServer: false,
    env: { ENABLE_TEST_API: 'true', ACCOUNT_TEST_MODE: 'true', VITE_ACCOUNT_TEST_MODE: 'true', COUNTDOWN_MS: '100', QUEUE_BOT_DELAY_MS: '60000', PORT: String(serverPort), CLIENT_ORIGIN: clientOrigin, VITE_SERVER_URL: `http://127.0.0.1:${serverPort}` },
  },
});
