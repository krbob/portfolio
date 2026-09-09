import { expect, test } from '@playwright/test'

for (const fails of [false, true]) {
  test(`@smoke saved overview stays visible during ${fails ? 'failed' : 'slow'} refresh`, async ({ page }) => {
    let saved: Record<string, unknown>
    let releaseRefresh: () => void = () => {}
    const release = new Promise<void>((resolve) => { releaseRefresh = resolve })
    await page.route('**/api/v1/portfolio/overview?preferCached=true', async (route) => {
      const response = await route.fetch()
      saved = await response.json()
      await route.fulfill({ response, json: {
        ...saved,
        valuationSnapshot: { generatedAt: '2026-03-20T10:00:00Z', fromCache: true, refreshRequired: true },
      } })
    })
    await page.route(/\/api\/v1\/portfolio\/overview$/, async (route) => {
      await release
      await route.fulfill({
        status: fails ? 503 : 200,
        json: fails ? { message: 'Upstream unavailable' } : {
          ...saved,
          valuationSnapshot: { generatedAt: '2026-03-20T10:05:00Z', fromCache: false, refreshRequired: false },
        },
      })
    })
    await page.goto('/')
    const refreshing = page.getByText('Pokazujemy ostatnią poprawną wycenę.', { exact: false })
    const timestamp = page.getByText('Wycena obliczona', { exact: false })
    await expect(refreshing).toBeVisible()
    await expect(timestamp).toBeVisible()
    const savedTimestamp = await timestamp.innerText()
    await expect(page.locator('main')).toContainText(/wartość|value/i)
    releaseRefresh()
    await expect(refreshing).not.toBeVisible()
    if (fails) {
      await expect(page.getByText('Nie udało się odświeżyć wyceny.', { exact: false })).toBeVisible()
      await expect(timestamp).toHaveText(savedTimestamp)
    } else {
      await expect(timestamp).not.toHaveText(savedTimestamp)
    }
  })
}
