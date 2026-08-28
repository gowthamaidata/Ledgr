import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'list',

  use: {
    baseURL: process.env.LEDGR_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'Mobile Chrome (Pixel 5)',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari (iPhone 12)',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start a server — assumes dev server already running
  // webServer: { command: 'npm run dev', port: 5173 },
});
