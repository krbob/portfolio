import { expect, test } from '@playwright/test'

test.describe('keyboard accessibility', () => {
  test('mobile navigation traps focus and restores it to the opener', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const opener = page.getByRole('button', { name: /open navigation|otwórz nawigację/i })
    await opener.focus()
    await opener.click()

    const dialog = page.getByRole('dialog', { name: /navigation|nawigacja/i })
    const close = dialog.getByRole('button', { name: /close navigation|zamknij nawigację/i })
    await expect(close).toBeFocused()
    await expect(page.locator('main')).toHaveAttribute('inert', '')
    await expect(page.locator('main')).toHaveAttribute('aria-hidden', 'true')

    await page.keyboard.press('Shift+Tab')
    await expect.poll(() => page.evaluate(() => (
      document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false
    ))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('sortable portfolio tables expose direction and rows support Enter', async ({ page }) => {
    await page.goto('/portfolio/accounts')

    const rows = page.locator('tbody tr[tabindex="0"]')
    await expect(rows.first()).toBeVisible({ timeout: 60_000 })

    const sortedHeader = page.locator('th[aria-sort]').first()
    await expect(sortedHeader).toHaveAttribute('aria-sort', /ascending|descending/)

    const secondRow = rows.nth(Math.min(1, (await rows.count()) - 1))
    await secondRow.focus()
    await page.keyboard.press('Enter')
    await expect(secondRow).toHaveAttribute('aria-selected', 'true')
  })

  test('performance charts expose a keyboard-operable data table', async ({ page }) => {
    await page.goto('/performance')

    const dataToggle = page.getByText(/show chart data|pokaż dane wykresu/i).first()
    await expect(dataToggle).toBeVisible({ timeout: 60_000 })

    await dataToggle.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('table', { name: /portfolio performance|wynik portfela/i })).toBeVisible()
  })
})
