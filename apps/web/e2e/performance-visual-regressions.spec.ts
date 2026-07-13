import { expect, test, type Locator, type Page } from '@playwright/test'

test('performance unit changes keep a compact header, viewport and focus @smoke', async ({ page }) => {
  await mockPerformanceApi(page)
  await page.goto('/performance')

  const unitControl = page.getByRole('group', { name: 'Jednostka wykresu wyników' })
  const initialHeading = page.getByRole('heading', { name: 'Wartość portfela (PLN)' })
  await expect(unitControl).toBeVisible()
  await expect(initialHeading).toBeVisible()

  const chartCard = unitControl.locator('xpath=ancestor::div[contains(@class,"rounded-ui-card")][1]')
  await chartCard.evaluate((card) => {
    const main = card.closest('main')
    if (!main) throw new Error('Performance chart is not inside the main scroll container.')
    const mainTop = main.getBoundingClientRect().top
    main.scrollTop += card.getBoundingClientRect().top - mainTop - 80
  })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await page.locator('main').evaluate(async (main) => {
    await Promise.all(main.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
  })

  const baseline = await geometry(page, chartCard, initialHeading, unitControl)
  expect(baseline.mainScrollTop).toBeGreaterThan(0)
  expect(baseline.titleInset).toBeGreaterThanOrEqual(16)
  expect(baseline.titleInset).toBeLessThanOrEqual(28)
  expect(Math.abs(baseline.titleTop - baseline.controlTop)).toBeLessThanOrEqual(8)

  for (const choice of [
    { button: 'USD', title: 'Wartość portfela (USD)' },
    { button: 'Złoto', title: 'Wartość portfela (AU)' },
    { button: 'PLN', title: 'Wartość portfela (PLN)' },
  ]) {
    const button = unitControl.getByRole('button', { name: choice.button, exact: true })
    await button.click()
    const heading = page.getByRole('heading', { name: choice.title })
    await expect(heading).toBeVisible()
    await expect(button).toBeFocused()
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))

    const current = await geometry(page, chartCard, heading, unitControl)
    expect(current.mainScrollTop).toBeCloseTo(baseline.mainScrollTop, 1)
    expect(current.windowScrollY).toBeCloseTo(baseline.windowScrollY, 1)
    expect(current.cardTop).toBeCloseTo(baseline.cardTop, 1)
    expect(current.cardHeight).toBeCloseTo(baseline.cardHeight, 1)
    expect(current.titleInset).toBeGreaterThanOrEqual(16)
    expect(current.titleInset).toBeLessThanOrEqual(28)
    expect(Math.abs(current.titleTop - current.controlTop)).toBeLessThanOrEqual(8)
  }
})

async function geometry(
  page: Page,
  chartCard: Locator,
  heading: Locator,
  unitControl: Locator,
) {
  const [cardBox, headingBox, controlBox] = await Promise.all([
    chartCard.boundingBox(),
    heading.boundingBox(),
    unitControl.boundingBox(),
  ])
  if (!cardBox || !headingBox || !controlBox) throw new Error('Performance chart geometry is unavailable.')

  return {
    mainScrollTop: await page.locator('main').evaluate((main) => main.scrollTop),
    windowScrollY: await page.evaluate(() => window.scrollY),
    cardTop: cardBox.y,
    cardHeight: cardBox.height,
    titleTop: headingBox.y,
    controlTop: controlBox.y,
    titleInset: headingBox.y - cardBox.y,
  }
}

async function mockPerformanceApi(page: Page) {
  const points = [
    historyPoint('2026-07-12', '205000.00', '51250.00', '34.166667'),
    historyPoint('2026-07-13', '210000.00', '52500.00', '35.000000'),
  ]

  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    let body: unknown

    if (pathname.endsWith('/auth/session')) {
      body = { authEnabled: false, authenticated: true, mode: 'DISABLED' }
    } else if (pathname.endsWith('/meta')) {
      body = {
        name: 'Portfolio',
        stage: 'test',
        version: 'performance-visual-regression',
        auth: { enabled: false, mode: 'DISABLED' },
        stack: { web: 'React', api: 'Kotlin', database: 'SQLite' },
        capabilities: [],
      }
    } else if (pathname.includes('/readiness')) {
      body = { status: 'READY', checkedAt: '2026-07-13T08:00:00Z', checks: [] }
    } else if (pathname.endsWith('/portfolio/overview')) {
      body = {
        asOf: '2026-07-13',
        valuationState: 'MARK_TO_MARKET',
        totalBookValuePln: '200000.00',
        totalCurrentValuePln: '210000.00',
        investedBookValuePln: '180000.00',
        investedCurrentValuePln: '190000.00',
        cashBalancePln: '20000.00',
        netContributionsPln: '200000.00',
        equityBookValuePln: '110000.00',
        equityCurrentValuePln: '120000.00',
        bondBookValuePln: '70000.00',
        bondCurrentValuePln: '70000.00',
        cashBookValuePln: '20000.00',
        cashCurrentValuePln: '20000.00',
        totalUnrealizedGainPln: '10000.00',
        totalPreviousCloseValuePln: '209000.00',
        accountCount: 2,
        instrumentCount: 3,
        activeHoldingCount: 3,
        valuedHoldingCount: 3,
        unvaluedHoldingCount: 0,
        valuationIssueCount: 0,
        missingFxTransactions: 0,
        unsupportedCorrectionTransactions: 0,
      }
    } else if (pathname.endsWith('/portfolio/history/daily')) {
      body = {
        from: '2026-07-12',
        until: '2026-07-13',
        valuationState: 'MARK_TO_MARKET',
        instrumentHistoryIssueCount: 0,
        referenceSeriesIssueCount: 0,
        benchmarkSeriesIssueCount: 0,
        missingFxTransactions: 0,
        unsupportedCorrectionTransactions: 0,
        points,
      }
    } else if (pathname.endsWith('/portfolio/returns')) {
      body = { asOf: '2026-07-13', periods: [] }
    } else if (pathname.endsWith('/portfolio/benchmark-settings')) {
      body = { enabledKeys: [], pinnedKeys: [], customBenchmarks: [], options: [] }
    } else {
      body = []
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

function historyPoint(date: string, pln: string, usd: string, gold: string) {
  return {
    date,
    totalBookValuePln: '200000.00',
    totalCurrentValuePln: pln,
    netContributionsPln: '200000.00',
    cashBalancePln: '20000.00',
    totalCurrentValueUsd: usd,
    netContributionsUsd: '50000.00',
    cashBalanceUsd: '5000.00',
    totalCurrentValueAu: gold,
    netContributionsAu: '33.333333',
    cashBalanceAu: '3.333333',
    equityCurrentValuePln: '120000.00',
    bondCurrentValuePln: '70000.00',
    cashCurrentValuePln: '20000.00',
    equityAllocationPct: '57.14',
    bondAllocationPct: '33.33',
    cashAllocationPct: '9.52',
    portfolioPerformanceIndex: '105.00',
    benchmarkIndices: {},
    activeHoldingCount: 3,
    valuedHoldingCount: 3,
  }
}
