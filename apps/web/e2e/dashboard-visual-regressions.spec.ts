import { expect, test, type Page } from '@playwright/test'

test('dashboard keeps attention-panel spacing and the neutral dark palette @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await mockDashboardApi(page)

  await page.goto('/')

  const alerts = page.getByRole('heading', { name: 'Aktywne alerty' }).locator('xpath=ancestor::section[1]')
  const checklist = page.getByRole('heading', {
    name: 'Są otwarte punkty konfiguracji lub zaufania do danych',
  }).locator('xpath=ancestor::section[1]')
  await expect(alerts).toBeVisible()
  await expect(checklist).toBeVisible()

  const alertsBox = await alerts.boundingBox()
  const checklistBox = await checklist.boundingBox()
  expect(alertsBox).not.toBeNull()
  expect(checklistBox).not.toBeNull()
  const gap = checklistBox!.y - (alertsBox!.y + alertsBox!.height)
  expect(gap).toBeGreaterThanOrEqual(16)

  const palette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const raisedSurface = document.querySelector<HTMLElement>('.bg-ui-surface-raised')
    return {
      canvasToken: root.getPropertyValue('--ui-color-canvas').trim(),
      surfaceToken: root.getPropertyValue('--ui-color-surface').trim(),
      raisedToken: root.getPropertyValue('--ui-color-surface-raised').trim(),
      body: getComputedStyle(document.body).backgroundColor,
      raisedSurface: raisedSurface ? getComputedStyle(raisedSurface).backgroundColor : null,
    }
  })
  expect(palette).toEqual({
    canvasToken: '#09090b',
    surfaceToken: '#151517',
    raisedToken: '#18181b',
    body: 'rgb(9, 9, 11)',
    raisedSurface: 'rgb(24, 24, 27)',
  })

  const twrCard = page.getByText('YTD TWRR').locator('xpath=ancestor::*[self::a or self::div][1]')
  await expect(twrCard).toContainText('+13,59%')
  const twrBox = await twrCard.boundingBox()
  expect(twrBox).not.toBeNull()
  expect(twrBox!.y + twrBox!.height).toBeLessThanOrEqual(1080)
})

for (const width of [393, 1920]) {
  for (const refreshFailed of [false, true]) {
    test(`dashboard status updates keep cards in place (${width}px, refresh failed: ${refreshFailed})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1080 })
      const analytics = ['/history/daily', '/returns', '/alerts']
      const requested = new Set<string>()
      const gates = new Map<string, { promise: Promise<void>; release: () => void }>()
      for (const key of [...analytics.flatMap((path) => [`${path}:preview`, `${path}:live`]), '/overview:live']) {
        let release!: () => void
        const promise = new Promise<void>((resolve) => { release = resolve })
        gates.set(key, { promise, release })
      }
      await mockDashboardApi(page, async (url, body) => {
        const preview = url.searchParams.get('preferCached') === 'true'
        const path = analytics.find((path) => url.pathname.endsWith(`/portfolio${path}`))
          ?? (url.pathname.endsWith('/portfolio/overview') ? '/overview' : undefined)
        if (!path) return { body }
        const key = `${path}:${preview ? 'preview' : 'live'}`
        requested.add(key)
        await gates.get(key)?.promise
        const snapshot = {
          generatedAt: preview || refreshFailed ? '2026-07-13T08:00:00Z' : '2026-07-13T08:05:00Z',
          fromCache: preview || refreshFailed,
          refreshRequired: preview,
          refreshFailed: !preview && refreshFailed,
        }
        return path === '/overview'
          ? { body: { ...(body as object), valuationSnapshot: snapshot } }
          : {
            body: path === '/alerts' ? [] : body,
            headers: {
              'X-Read-Model-Generated-At': snapshot.generatedAt,
              'X-Read-Model-From-Cache': String(snapshot.fromCache),
              'X-Read-Model-Refresh-Required': String(snapshot.refreshRequired),
              'X-Read-Model-Refresh-Failed': String(snapshot.refreshFailed),
            },
          }
      })

      try {
        await page.goto('/')
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
        const status = page.getByRole('button', { name: 'Aktualność danych', exact: true })
        await expect(status).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Są otwarte punkty konfiguracji lub zaufania do danych' })).toBeVisible()
        const card = page.getByText('Zmiana dzienna', { exact: true }).locator('..')
        await expect(card).toBeVisible()
        const initialCard = (await card.boundingBox())!
        const initialStatus = (await status.boundingBox())!

        async function expectStablePosition() {
          await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
          const currentCard = (await card.boundingBox())!
          const currentStatus = (await status.boundingBox())!
          expect(currentCard.y).toBeCloseTo(initialCard.y, 1)
          expect(currentStatus.height).toBe(initialStatus.height)
          expect(currentStatus.width).toBe(initialStatus.width)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        }

        for (const path of analytics) {
          await expect.poll(() => requested.has(`${path}:preview`)).toBe(true)
          gates.get(`${path}:preview`)!.release()
          await expect.poll(() => requested.has(`${path}:live`)).toBe(true)
          await expectStablePosition()
        }
        for (const path of ['/overview', ...analytics]) {
          const finished = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return url.pathname.endsWith(`/portfolio${path}`) && url.searchParams.get('preferCached') !== 'true'
          })
          gates.get(`${path}:live`)!.release()
          await finished
          await expectStablePosition()
        }
        if (refreshFailed) await expect(status).toContainText('Błąd odświeżania')
        else await expect(status).not.toContainText('Odświeżanie')
        await page.screenshot({ path: testInfo.outputPath('dashboard-status.png') })

        await status.click()
        const dialog = page.getByRole('dialog', { name: 'Aktualność danych' })
        await expect(dialog).toBeVisible()
        await expect(dialog.locator('time')).toHaveCount(4)
        for (const label of ['Wycena', 'Historia', 'Zwroty', 'Alerty']) {
          await expect(dialog.getByText(label, { exact: true })).toBeVisible()
          if (refreshFailed) await expect(dialog.getByRole('button', { name: `Ponów: ${label}`, exact: true })).toBeVisible()
        }
        await page.screenshot({ path: testInfo.outputPath('dashboard-status-details.png') })
        await page.keyboard.press('Escape')
        await expect(dialog).not.toBeVisible()
        await expect(status).toBeFocused()
        await expectStablePosition()
      } finally {
        for (const gate of gates.values()) gate.release()
      }
    })
  }
}

interface DashboardMockResponse {
  body: unknown
  headers?: Record<string, string>
}

async function mockDashboardApi(page: Page, transform?: (url: URL, body: unknown) => Promise<DashboardMockResponse>) {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    let body: unknown

    if (pathname.endsWith('/auth/session')) {
      body = { authEnabled: false, authenticated: true, mode: 'DISABLED' }
    } else if (pathname.endsWith('/meta')) {
      body = {
        name: 'Portfolio',
        stage: 'test',
        version: 'visual-regression',
        auth: { enabled: false, mode: 'DISABLED' },
        stack: { web: 'React', api: 'Kotlin', database: 'SQLite' },
        capabilities: [],
      }
    } else if (pathname.includes('/readiness')) {
      body = { status: 'READY', checkedAt: '2026-07-13T08:00:00Z', checks: [] }
    } else if (pathname.endsWith('/portfolio/alerts')) {
      body = [{
        id: 'allocation:EQUITIES',
        type: 'ALLOCATION_DRIFT',
        severity: 'WARNING',
        title: 'Dryf alokacji: akcje',
        message: 'Odchylenie wynosi 6,4 pp przy progu 5,00 pp.',
        route: '/strategy/targets',
        observedAt: '2026-07-13T08:00:00Z',
      }]
    } else if (pathname.endsWith('/portfolio/overview')) {
      body = {
        asOf: '2026-07-13',
        valuationState: 'MARK_TO_MARKET',
        totalBookValuePln: '200000.00',
        totalCurrentValuePln: '210000.00',
        investedBookValuePln: '180000.00',
        investedCurrentValuePln: '190000.00',
        cashBalancePln: '20000.00',
        cashBalances: [{ currency: 'PLN', amount: '20000.00', bookValuePln: '20000.00' }],
        netContributionsPln: '200000.00',
        netContributionBalances: [{ currency: 'PLN', amount: '200000.00', bookValuePln: '200000.00' }],
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
        points: [],
      }
    } else if (pathname.endsWith('/portfolio/returns')) {
      body = {
        asOf: '2026-07-13',
        periods: [{
          key: 'YTD',
          nominalPln: { timeWeightedReturn: '0.1359' },
          benchmarks: [],
        }],
      }
    } else if (pathname.endsWith('/portfolio/allocation')) {
      body = {
        asOf: '2026-07-13',
        valuationState: 'MARK_TO_MARKET',
        configured: false,
        toleranceBandPctPoints: '5.00',
        rebalancingMode: 'CONTRIBUTIONS_ONLY',
        targetWeightSumPct: '0.00',
        totalCurrentValuePln: '210000.00',
        availableCashPln: '20000.00',
        breachedBucketCount: 0,
        recommendedAction: 'WITHIN_TOLERANCE',
        recommendedContributionPln: '0.00',
        remainingContributionGapPln: '0.00',
        fullRebalanceBuyAmountPln: '0.00',
        fullRebalanceSellAmountPln: '0.00',
        requiresSelling: false,
        buckets: [],
      }
    } else if (pathname.endsWith('/portfolio/read-model-refresh')) {
      body = {
        schedulerEnabled: true,
        intervalMinutes: 720,
        running: false,
        lastRunAt: '2026-07-13T08:00:00Z',
        lastSuccessAt: '2026-07-13T08:00:00Z',
        lastFailureAt: null,
      }
    } else if (pathname.endsWith('/portfolio/benchmark-settings')) {
      body = { enabledKeys: [], pinnedKeys: [], customBenchmarks: [] }
    } else {
      body = []
    }

    const response = transform ? await transform(new URL(route.request().url()), body) : { body }
    await route.fulfill({
      contentType: 'application/json',
      headers: response.headers,
      body: JSON.stringify(response.body),
    })
  })
}
