import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:3737',
  },
  webServer: {
    command: 'bun run server',
    url: 'http://127.0.0.1:3737/health',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
