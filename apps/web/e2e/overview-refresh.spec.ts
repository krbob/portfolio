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
    await expect(page.getByText('Wartość portfela', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Aktualność danych' }).click()
    const details = page.getByRole('dialog', { name: 'Aktualność danych' })
    const refreshing = details.getByText('Pokazujemy ostatnią poprawną wycenę.', { exact: false })
    const timestamp = details.getByText('Wycena', { exact: true }).locator('..').locator('time')
    await expect(refreshing).toBeVisible()
    await expect(timestamp).toBeVisible()
    await expect(timestamp).toHaveAttribute('datetime', '2026-03-20T10:00:00Z')
    releaseRefresh()
    await expect(refreshing).not.toBeVisible()
    if (fails) {
      await expect(details.getByText('Nie udało się odświeżyć wyceny.', { exact: false })).toBeVisible()
      await expect(timestamp).toHaveAttribute('datetime', '2026-03-20T10:00:00Z')
    } else {
      await expect(timestamp).toHaveAttribute('datetime', '2026-03-20T10:05:00Z')
    }
  })
}
