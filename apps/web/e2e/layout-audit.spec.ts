import { expect, test, type Page } from '@playwright/test'

/**
 * Layout audit – captures full-page screenshots of every major screen
 * at desktop (1440×900) and mobile (390×844) viewports.
 *
 * Prerequisites: the stack must be running with demo data already seeded
 * (run screenshots.spec.ts first, or seed manually).
 */

const API = '/api/v1'
const OUTPUT = 'test-results/layout-audit'

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

// ── helpers ───────────────────────────────────────────────────────────

async function waitForContent(page: Page) {
  // Polish UI uses "Ładowanie", English uses "Loading"
  await expect(page.getByText(/Loading|Ładowanie/)).toHaveCount(0, { timeout: 20_000 })
  await page.waitForTimeout(800)
}

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${OUTPUT}/${name}.png`, fullPage: true })
}

// ── seed guard ────────────────────────────────────────────────────────

let hasData = false

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    const res = await page.evaluate(async (url) => {
      const r = await fetch(url)
      return r.json()
    }, API + '/portfolio/holdings')
    hasData = Array.isArray(res) && res.length > 0
  } catch {
    hasData = false
  }
  await ctx.close()
})

// ── desktop screenshots ───────────────────────────────────────────────

test.describe('Desktop layout audit', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'dark', deviceScaleFactor: 2 })

  test('Dashboard', async ({ page }) => {
    await page.goto('/')
    await waitForContent(page)
    await snap(page, 'desktop-01-dashboard')
  })

  test('Portfolio > Holdings', async ({ page }) => {
    await page.goto('/portfolio')
    await waitForContent(page)
    await snap(page, 'desktop-02-holdings')
  })

  test('Portfolio > Accounts', async ({ page }) => {
    await page.goto('/portfolio?tab=accounts')
    await waitForContent(page)
    await snap(page, 'desktop-03-accounts')
  })

  test('Performance > Charts', async ({ page }) => {
    await page.goto('/performance')
    await waitForContent(page)
    await snap(page, 'desktop-04-performance-charts')
  })

  test('Performance > Returns', async ({ page }) => {
    await page.goto('/performance')
    await waitForContent(page)
    await page.getByRole('tab', { name: /zwrot|return/i }).click()
    await page.waitForTimeout(600)
    await snap(page, 'desktop-05-performance-returns')
  })

  test('Transactions', async ({ page }) => {
    await page.goto('/transactions')
    await waitForContent(page)
    await snap(page, 'desktop-06-transactions')
  })

  test('Settings (top)', async ({ page }) => {
    await page.goto('/settings')
    await waitForContent(page)
    await snap(page, 'desktop-07-settings')
  })

  test('Settings > Instruments', async ({ page }) => {
    await page.goto('/settings#instruments')
    await waitForContent(page)
    await snap(page, 'desktop-08-settings-instruments')
  })

  test('Settings > Targets', async ({ page }) => {
    await page.goto('/settings#targets')
    await waitForContent(page)
    await snap(page, 'desktop-09-settings-targets')
  })
})

// ── mobile screenshots ────────────────────────────────────────────────

test.describe('Mobile layout audit', () => {
  test.use({ viewport: MOBILE, colorScheme: 'dark', deviceScaleFactor: 2 })

  test('Dashboard', async ({ page }) => {
    await page.goto('/')
    await waitForContent(page)
    await snap(page, 'mobile-01-dashboard')
  })

  test('Portfolio > Holdings', async ({ page }) => {
    await page.goto('/portfolio')
    await waitForContent(page)
    await snap(page, 'mobile-02-holdings')
  })

  test('Portfolio > Accounts', async ({ page }) => {
    await page.goto('/portfolio?tab=accounts')
    await waitForContent(page)
    await snap(page, 'mobile-03-accounts')
  })

  test('Performance > Charts', async ({ page }) => {
    await page.goto('/performance')
    await waitForContent(page)
    await snap(page, 'mobile-04-performance-charts')
  })

  test('Performance > Returns', async ({ page }) => {
    await page.goto('/performance')
    await waitForContent(page)
    await page.getByRole('tab', { name: /zwrot|return/i }).click()
    await page.waitForTimeout(600)
    await snap(page, 'mobile-05-performance-returns')
  })

  test('Transactions', async ({ page }) => {
    await page.goto('/transactions')
    await waitForContent(page)
    await snap(page, 'mobile-06-transactions')
  })

  test('Transactions > Composer (modal)', async ({ page }) => {
    await page.goto('/transactions')
    await waitForContent(page)
    // Open the composer
    const addBtn = page.getByRole('button', { name: /dodaj|nowa|composit|add/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(400)
    }
    await snap(page, 'mobile-07-transactions-composer')
  })

  test('Settings (top)', async ({ page }) => {
    await page.goto('/settings')
    await waitForContent(page)
    await snap(page, 'mobile-08-settings')
  })

  test('Settings > Targets', async ({ page }) => {
    await page.goto('/settings#targets')
    await waitForContent(page)
    await snap(page, 'mobile-09-settings-targets')
  })

  test('Settings > Instruments', async ({ page }) => {
    await page.goto('/settings#instruments')
    await waitForContent(page)
    await snap(page, 'mobile-10-settings-instruments')
  })

  test('Navigation drawer', async ({ page }) => {
    await page.goto('/')
    await waitForContent(page)
    // Open mobile nav
    const menuBtn = page.getByRole('button', { name: /nawigac|menu|open/i })
    if (await menuBtn.count() > 0) {
      await menuBtn.first().click()
      await page.waitForTimeout(300)
    }
    await snap(page, 'mobile-11-navigation')
  })
})
