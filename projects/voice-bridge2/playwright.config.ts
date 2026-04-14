import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/renderer/tests',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bunx vite --config vite.test.config.ts',
    port: 5199,
    reuseExistingServer: !process.env['CI'],
    timeout: 30000,
  },
})
