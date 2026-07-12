import { expect, test } from '@playwright/test'

test('consumes neutral UI preferences and exposes a keyboard-reachable Stock Analyst handoff', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/meta', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Portfolio',
        stage: 'dev',
        version: '3.5.0',
        persistenceMode: 'SQLITE',
        auth: { enabled: false, mode: 'DISABLED' },
        stack: {
          web: 'React 19 + TypeScript + Vite',
          api: 'Kotlin 2.3 + Ktor 3',
          database: 'SQLite',
        },
        capabilities: [],
        stockAnalystUiUrl: 'https://stocks.example/app?tenant=personal',
      }),
    })
  })

  await page.goto('/?view=overview&uiTheme=dark&uiLocale=pl-pl')

  await expect.poll(() => page.evaluate(() => window.location.search)).toBe('?view=overview')
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('portfolio:ui-theme'))).toBe('dark')
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('portfolio:ui-locale'))).toBe('pl-PL')
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('pl')

  const switcher = page.locator('header').getByRole('link', { name: /stock analyst/i })
  await expect(switcher).toBeVisible()
  await expect(switcher).toHaveAttribute(
    'href',
    'https://stocks.example/app?tenant=personal&uiTheme=dark&uiLocale=pl-PL',
  )
  await expect(switcher).not.toHaveAttribute('target', /.+/)

  for (let attempt = 0; attempt < 8 && !(await switcher.evaluate((element) => element === document.activeElement)); attempt += 1) {
    await page.keyboard.press('Tab')
  }
  await expect(switcher).toBeFocused()
  await expect.poll(() => switcher.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
