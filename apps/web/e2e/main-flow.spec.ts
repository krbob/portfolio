import { expect, test } from '@playwright/test'

test('main seeded flow renders across core routes @smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Konta' })).toBeVisible()

  await page.getByRole('link', { name: 'Konta' }).click()
  await expect(page).toHaveURL(/\/accounts$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Konta', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Treasury Bonds Register').first()).toBeVisible()

  await page.getByRole('link', { name: 'Instrumenty' }).click()
  await expect(page).toHaveURL(/\/instruments$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Instrumenty', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Vanguard FTSE All-World UCITS ETF').first()).toBeVisible()

  await page.getByRole('link', { name: 'Transakcje' }).click()
  await expect(page).toHaveURL(/\/transactions$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Transakcje', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Wiersze dziennika w widoku')).toBeVisible()

  await page.getByRole('link', { name: 'Pozycje' }).click()
  await expect(page).toHaveURL(/\/holdings$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Pozycje', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('EDO1235').first()).toBeVisible()

  await page.getByRole('link', { name: 'Wyniki' }).click()
  await expect(page).toHaveURL(/\/performance$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Wyniki', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Benchmarki').first()).toBeVisible()
})
