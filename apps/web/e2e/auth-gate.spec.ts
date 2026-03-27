import { expect, test } from '@playwright/test'

const PASSWORD = process.env.PORTFOLIO_E2E_PASSWORD ?? 'smoke-pass-123456'

test('auth gate protects the app and allows login plus logout @auth', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible()
  await expect(page.getByPlaceholder('Wpisz hasło')).toBeVisible()

  await page.getByPlaceholder('Wpisz hasło').fill(PASSWORD)
  await page.getByRole('button', { name: 'Odblokuj' }).click()

  await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()
  await expect(page.locator('main')).toContainText('Wartość portfela')

  await page.getByRole('button', { name: 'Wyloguj' }).click()
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible()
  await expect(page.getByPlaceholder('Wpisz hasło')).toBeVisible()
})
