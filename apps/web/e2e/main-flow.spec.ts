import { expect, test } from '@playwright/test'

test('main seeded flow renders across core routes @smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Portfel' })).toBeVisible()

  await page.getByRole('link', { name: 'Portfel' }).click()
  await expect(page).toHaveURL(/\/portfolio$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Portfel', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('EDO1235').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Konta' }).click()
  await expect(page).toHaveURL(/\/portfolio\?tab=accounts$/)
  await expect(page.locator('main').getByText('Treasury Bonds Register').first()).toBeVisible()

  await page.getByRole('link', { name: 'Transakcje' }).click()
  await expect(page).toHaveURL(/\/transactions$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Transakcje', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Wiersze dziennika w widoku')).toBeVisible()

  await page.getByRole('link', { name: 'Wyniki' }).click()
  await expect(page).toHaveURL(/\/performance$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Wyniki', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Benchmarki').first()).toBeVisible()

  await page.getByRole('link', { name: 'Ustawienia' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Ustawienia', exact: true })).toBeVisible()
})
