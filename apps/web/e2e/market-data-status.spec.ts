import { expect, test } from '@playwright/test'

test('renders generated Stock provenance as an accessible responsive status bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/portfolio/market-data-snapshots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          snapshotType: 'PRICE_SERIES',
          identity: 'stock-history:VWRA.L',
          cachedAt: '2026-03-20T20:03:00Z',
          status: 'FRESH',
          lastCheckedAt: '2026-03-20T20:03:00Z',
          failureCount: 0,
          provenance: {
            source: 'YAHOO_FINANCE',
            retrievedAt: '2026-03-20T20:02:00Z',
            marketTimestamp: '2026-03-20T20:00:00Z',
            marketDate: '2026-03-20',
            currency: 'USD',
            unitScale: 1,
            adjustment: 'SPLIT_ADJUSTED',
            coverageFrom: '2026-03-01',
            coverageTo: '2026-03-20',
            status: 'FRESH',
          },
        },
      ]),
    })
  })

  await page.goto('/')

  const statusBar = page.getByRole('region', { name: /status danych rynkowych|market data status/i })
  await expect(statusBar).toBeVisible()
  await expect(statusBar).toContainText('Yahoo Finance')
  await expect(statusBar).toContainText('USD')
  await expect(statusBar).toContainText('×1')
  await expect(statusBar).toContainText(/korekta split|split adjusted/i)
  await expect(statusBar).toContainText(/świeże|fresh/i)
  await expect(statusBar.locator('time')).toHaveCount(4)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
