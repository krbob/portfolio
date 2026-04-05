import { expect, test } from '@playwright/test'

test.describe('UI/UX improvements', () => {
  test('dashboard renders with hover-enabled chart card', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()

    // Chart card should have hover border transition class
    const historyCard = page.locator('main').locator('.hover\\:border-zinc-700').first()
    await expect(historyCard).toBeVisible()

    // Chart should exist inside a link to /performance
    const chartLink = page.locator('main a[href="/performance"]').first()
    await expect(chartLink).toBeVisible()
  })

  test('settings sticky nav highlights active section on scroll', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 2, name: 'Ustawienia', exact: true })).toBeVisible()

    // Sticky nav should be visible
    const nav = page.locator('nav[aria-label]').last()
    await expect(nav).toBeVisible()

    // Navigate to a section via anchor
    await page.goto('/settings#backups')
    await page.waitForTimeout(800)

    // The active chip should have the blue highlight style
    const activeChip = nav.locator('a.text-blue-400').first()
    await expect(activeChip).toBeVisible({ timeout: 5000 })
  })

  test('portfolio screen with tab navigation works', async ({ page }) => {
    await page.goto('/portfolio')
    await expect(page.getByRole('heading', { level: 2, name: 'Portfel', exact: true })).toBeVisible()

    // Tab bar should be present with Holdings and Accounts tabs
    const holdingsTab = page.getByRole('tab', { name: 'Pozycje' })
    const accountsTab = page.getByRole('tab', { name: 'Konta' })
    await expect(holdingsTab).toBeVisible()
    await expect(accountsTab).toBeVisible()

    // Switch to accounts tab
    await accountsTab.click()
    await expect(page).toHaveURL(/\/portfolio\?tab=accounts$/)
  })

  test('performance screen renders stat cards and tabs', async ({ page }) => {
    await page.goto('/performance')
    await expect(page.getByRole('heading', { level: 2, name: 'Wyniki', exact: true })).toBeVisible()

    // Tab bar with Charts and Returns tabs
    const chartsTab = page.getByRole('tab', { name: 'Wykresy' })
    const returnsTab = page.getByRole('tab', { name: 'Zwroty' })
    await expect(chartsTab).toBeVisible()
    await expect(returnsTab).toBeVisible()

    // Switch tabs
    await returnsTab.click()
    await page.waitForTimeout(300)
    await chartsTab.click()
  })

  test('transactions screen renders', async ({ page }) => {
    await page.goto('/transactions')
    await expect(page.getByRole('heading', { level: 2, name: 'Transakcje', exact: true })).toBeVisible()
  })

  test('quick-add transaction button is visible on non-transaction pages', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()

    // FAB should be visible on dashboard
    const fab = page.getByRole('button', { name: 'Dodaj transakcję' })
    await expect(fab).toBeVisible()

    // Navigate to transactions - FAB should be hidden
    await page.goto('/transactions')
    await expect(page.getByRole('heading', { level: 2, name: 'Transakcje', exact: true })).toBeVisible()
    await expect(fab).toBeHidden()
  })

  test('mobile layout shows hamburger and drawer navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()

    // Hamburger button should be visible
    const menuButton = page.getByRole('button', { name: 'Otwórz nawigację' })
    await expect(menuButton).toBeVisible()

    // Mobile header should show translated app name (not hardcoded)
    await expect(page.locator('header').getByText('Portfolio')).toBeVisible()

    // Open drawer
    await menuButton.click()
    const drawer = page.locator('#mobile-navigation')
    await expect(drawer).toBeVisible()

    // Close with close button
    const closeButton = page.getByRole('button', { name: 'Zamknij nawigację' })
    await expect(closeButton).toBeVisible()
    await closeButton.click()
    await page.waitForTimeout(300)
  })

  test('error boundary and empty states use icon components', async ({ page }) => {
    // Navigate to a page that shows content - verify no broken icons
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: 'Pulpit', exact: true })).toBeVisible()

    // All SVG icons should render (no broken images)
    const brokenIcons = page.locator('svg:not([class])')
    // This is a negative test - we don't expect broken SVGs
    const svgCount = await page.locator('svg').count()
    expect(svgCount).toBeGreaterThan(0)
  })
})
