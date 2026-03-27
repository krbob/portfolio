import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: process.env.PORTFOLIO_E2E_BASE_URL ?? 'http://127.0.0.1:24177',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    locale: 'pl-PL',
    trace: 'retain-on-failure',
  },
})
