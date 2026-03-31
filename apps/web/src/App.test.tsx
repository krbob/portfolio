import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { createStorageMock } from './test/app-smoke-fixtures'

describe('App', () => {
  beforeEach(() => {
    cleanup()
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    })
  })
  it('renders dashboard shell with API data', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            authEnabled: false,
            authenticated: true,
            mode: 'DISABLED',
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/meta')) {
        return new Response(
          JSON.stringify({
            name: 'Portfolio',
            stage: 'dev',
            version: '0.1.0-dev',
            auth: {
              enabled: false,
              mode: 'DISABLED',
            },
            stack: {
              web: 'React 19 + TypeScript + Vite',
              api: 'Kotlin 2.3 + Ktor 3',
              database: 'SQLite',
            },
            capabilities: ['Transaction-based portfolio accounting'],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/readiness')) {
        return new Response(
          JSON.stringify({
            status: 'READY',
            checkedAt: '2026-03-13T12:00:00Z',
            checks: [
              {
                key: 'sqlite-directory',
                label: 'SQLite directory',
                status: 'PASS',
                message: 'Using portfolio.db in /srv/portfolio/data.',
              },
              {
                key: 'sqlite-connection',
                label: 'SQLite connection',
                status: 'PASS',
                message: 'SQLite responded to a connection test query.',
              },
              {
                key: 'market-data',
                label: 'Market data',
                status: 'INFO',
                message: 'Live market data is disabled.',
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/overview')) {
        return new Response(
          JSON.stringify({
            asOf: '2026-03-13',
            valuationState: 'BOOK_ONLY',
            totalBookValuePln: '2000.00',
            totalCurrentValuePln: '2000.00',
            investedBookValuePln: '1005.00',
            investedCurrentValuePln: '1005.00',
            cashBalancePln: '995.00',
            netContributionsPln: '2000.00',
            equityBookValuePln: '1005.00',
            equityCurrentValuePln: '1005.00',
            bondBookValuePln: '0.00',
            bondCurrentValuePln: '0.00',
            cashBookValuePln: '995.00',
            cashCurrentValuePln: '995.00',
            totalUnrealizedGainPln: '0.00',
            accountCount: 1,
            instrumentCount: 1,
            activeHoldingCount: 1,
            valuedHoldingCount: 0,
            unvaluedHoldingCount: 1,
            valuationIssueCount: 1,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(
          JSON.stringify([
            {
              accountId: 'acc-1',
              accountName: 'Primary',
              instrumentId: 'ins-1',
              instrumentName: 'VWCE',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'EUR',
              quantity: '6',
              averageCostPerUnitPln: '100.50',
              costBasisPln: '603.00',
              bookValuePln: '603.00',
              currentPricePln: null,
              currentValuePln: null,
              unrealizedGainPln: null,
              valuedAt: null,
              valuationStatus: 'UNAVAILABLE',
              valuationIssue: 'Quote service unavailable.',
              transactionCount: 2,
            },
          ]),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/accounts')) {
        return new Response(
          JSON.stringify([
            {
              accountId: 'acc-1',
              accountName: 'Primary',
              institution: 'Broker',
              type: 'BROKERAGE',
              baseCurrency: 'PLN',
              valuationState: 'MARK_TO_MARKET',
              totalBookValuePln: '2000.00',
              totalCurrentValuePln: '2095.00',
              investedBookValuePln: '1100.00',
              investedCurrentValuePln: '1100.00',
              cashBalancePln: '995.00',
              netContributionsPln: '2000.00',
              totalUnrealizedGainPln: '95.00',
              portfolioWeightPct: '100.00',
              activeHoldingCount: 1,
              valuedHoldingCount: 1,
              valuationIssueCount: 0,
            },
          ]),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            from: '2026-03-01',
            until: '2026-03-03',
            valuationState: 'BOOK_ONLY',
            instrumentHistoryIssueCount: 1,
            referenceSeriesIssueCount: 0,
            benchmarkSeriesIssueCount: 0,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
            points: [
              {
                date: '2026-03-01',
                totalBookValuePln: '2000.00',
                totalCurrentValuePln: '2000.00',
                netContributionsPln: '2000.00',
                cashBalancePln: '2000.00',
                totalCurrentValueUsd: '500.00',
                netContributionsUsd: '500.00',
                cashBalanceUsd: '500.00',
                totalCurrentValueAu: '0.166667',
                netContributionsAu: '0.166667',
                cashBalanceAu: '0.166667',
                equityCurrentValuePln: '0.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '2000.00',
                equityAllocationPct: '0.00',
                bondAllocationPct: '0.00',
                cashAllocationPct: '100.00',
                portfolioPerformanceIndex: '100.00',
                benchmarkIndices: { VWRA: '100.00', INFLATION: '100.00', TARGET_MIX: '100.00' },
                activeHoldingCount: 0,
                valuedHoldingCount: 0,
              },
              {
                date: '2026-03-02',
                totalBookValuePln: '2000.00',
                totalCurrentValuePln: '2000.00',
                netContributionsPln: '2000.00',
                cashBalancePln: '995.00',
                totalCurrentValueUsd: '511.25',
                netContributionsUsd: '500.00',
                cashBalanceUsd: '248.75',
                totalCurrentValueAu: '0.168313',
                netContributionsAu: '0.164609',
                cashBalanceAu: '0.081893',
                equityCurrentValuePln: '1005.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '995.00',
                equityAllocationPct: '50.25',
                bondAllocationPct: '0.00',
                cashAllocationPct: '49.75',
                portfolioPerformanceIndex: '100.00',
                benchmarkIndices: { VWRA: '101.30', INFLATION: '100.20', TARGET_MIX: '101.08' },
                activeHoldingCount: 1,
                valuedHoldingCount: 0,
              },
              {
                date: '2026-03-03',
                totalBookValuePln: '2000.00',
                totalCurrentValuePln: '2000.00',
                netContributionsPln: '2000.00',
                cashBalancePln: '995.00',
                totalCurrentValueUsd: '510.98',
                netContributionsUsd: '487.80',
                cashBalanceUsd: '242.68',
                totalCurrentValueAu: '0.173140',
                netContributionsAu: '0.165289',
                cashBalanceAu: '0.082231',
                equityCurrentValuePln: '1005.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '995.00',
                equityAllocationPct: '50.25',
                bondAllocationPct: '0.00',
                cashAllocationPct: '49.75',
                portfolioPerformanceIndex: '100.00',
                benchmarkIndices: { VWRA: '102.40', INFLATION: '100.40', TARGET_MIX: '101.96' },
                activeHoldingCount: 1,
                valuedHoldingCount: 0,
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/returns')) {
        return new Response(
          JSON.stringify({
            asOf: '2026-03-13',
            periods: [],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/allocation')) {
        return new Response(
          JSON.stringify({
            asOf: '2026-03-13',
            valuationState: 'MARK_TO_MARKET',
            configured: true,
            toleranceBandPctPoints: '5.00',
            rebalancingMode: 'CONTRIBUTIONS_ONLY',
            targetWeightSumPct: '100.00',
            totalCurrentValuePln: '2095.00',
            availableCashPln: '995.00',
            breachedBucketCount: 0,
            largestBandBreachPctPoints: null,
            recommendedAction: 'WITHIN_TOLERANCE',
            recommendedAssetClass: null,
            recommendedContributionPln: '0.00',
            remainingContributionGapPln: '0.00',
            fullRebalanceBuyAmountPln: '10.06',
            fullRebalanceSellAmountPln: '10.06',
            requiresSelling: false,
            buckets: [
              {
                assetClass: 'EQUITIES',
                currentValuePln: '1665.00',
                currentWeightPct: '79.52',
                targetWeightPct: '80.00',
                targetValuePln: '1676.00',
                driftPctPoints: '-0.48',
                gapValuePln: '10.06',
                toleranceLowerPct: '75.00',
                toleranceUpperPct: '85.00',
                withinTolerance: true,
                suggestedContributionPln: '0.00',
                rebalanceAction: 'HOLD',
                status: 'ON_TARGET',
              },
              {
                assetClass: 'BONDS',
                currentValuePln: '430.00',
                currentWeightPct: '20.48',
                targetWeightPct: '20.00',
                targetValuePln: '419.00',
                driftPctPoints: '+0.48',
                gapValuePln: '-10.06',
                toleranceLowerPct: '15.00',
                toleranceUpperPct: '25.00',
                withinTolerance: true,
                suggestedContributionPln: '0.00',
                rebalanceAction: 'HOLD',
                status: 'ON_TARGET',
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/rebalancing-settings')) {
        return new Response(
          JSON.stringify({
            toleranceBandPctPoints: '5.00',
            mode: 'CONTRIBUTIONS_ONLY',
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/read-model-refresh')) {
        return new Response(
          JSON.stringify({
            schedulerEnabled: false,
            intervalMinutes: 720,
            runOnStart: true,
            running: false,
            lastRunAt: '2026-03-13T12:00:00Z',
            lastSuccessAt: '2026-03-13T12:00:00Z',
            lastFailureAt: null,
            lastFailureMessage: null,
            lastTrigger: 'MANUAL',
            lastDurationMs: 420,
            modelNames: ['DAILY_HISTORY', 'RETURNS'],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/audit/events')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/targets')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/backups')) {
        return new Response(
          JSON.stringify({
            schedulerEnabled: false,
            directory: '/srv/portfolio/backups',
            intervalMinutes: 1440,
            retentionCount: 30,
            running: false,
            lastRunAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureMessage: null,
            backups: [],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/accounts') || url.includes('/api/v1/instruments') || url.includes('/api/v1/transactions')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    // Sidebar navigation links
    expect(await screen.findByRole('link', { name: /^dashboard$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^portfolio$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument()

    // Sidebar runtime status
    expect(await screen.findByText(/runtime health/i)).toBeInTheDocument()
    expect(await screen.findByText(/healthy/i)).toBeInTheDocument()
    expect(await screen.findByText(/0 blockers · 1 notices/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open health/i })).toHaveAttribute('href', '/settings#health')

    // Dashboard page header
    expect(await screen.findByRole('heading', { name: /^dashboard$/i })).toBeInTheDocument()

    // Dashboard stat cards
    expect((await screen.findAllByText(/book value/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/daily change/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/requires full market valuation/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/valuation basis/i)).toBeInTheDocument()
    expect(await screen.findByText(/within.*±5\.00 pp.*tolerance/i)).toBeInTheDocument()
    expect(await screen.findByText(/80% \/ 80%/)).toBeInTheDocument()
  })

  it('shows the login gate when password auth is enabled', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            authEnabled: true,
            authenticated: false,
            mode: 'PASSWORD',
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/meta')) {
        return new Response(
          JSON.stringify({
            name: 'Portfolio',
            stage: 'dev',
            version: '0.1.0-dev',
            auth: {
              enabled: true,
              mode: 'PASSWORD',
            },
            stack: {
              web: 'React 19 + TypeScript + Vite',
              api: 'Kotlin 2.3 + Ktor 3',
              database: 'SQLite',
            },
            capabilities: ['Transaction-based portfolio accounting'],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in auth gate test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByPlaceholderText(/enter password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    expect(screen.getByText(/self-hosted portfolio tracker/i)).toBeInTheDocument()
  })

  it('shows holdings in book-basis mode without alarming status spam', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            authEnabled: false,
            authenticated: true,
            mode: 'DISABLED',
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/meta')) {
        return new Response(
          JSON.stringify({
            name: 'Portfolio',
            stage: 'dev',
            version: '0.1.0-dev',
            auth: {
              enabled: false,
              mode: 'DISABLED',
            },
            stack: {
              web: 'React 19 + TypeScript + Vite',
              api: 'Kotlin 2.3 + Ktor 3',
              database: 'SQLite',
            },
            capabilities: ['Transaction-based portfolio accounting'],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/readiness')) {
        return new Response(
          JSON.stringify({
            status: 'READY',
            checkedAt: '2026-03-13T12:00:00Z',
            checks: [],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(
          JSON.stringify([
            {
              accountId: 'acc-1',
              accountName: 'Primary',
              instrumentId: 'ins-1',
              instrumentName: 'VWCE',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'EUR',
              quantity: '6',
              averageCostPerUnitPln: '100.50',
              costBasisPln: '603.00',
              bookValuePln: '603.00',
              currentPricePln: null,
              currentValuePln: null,
              unrealizedGainPln: null,
              valuedAt: null,
              valuationStatus: 'UNAVAILABLE',
              valuationIssue: 'Quote service unavailable.',
              transactionCount: 2,
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in holdings valuation test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/portfolio']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^portfolio$/i })).toBeInTheDocument()
    expect(await screen.findByText(/valuation mode/i)).toBeInTheDocument()
    expect(await screen.findByText(/this view currently relies on book basis/i)).toBeInTheDocument()
    expect(await screen.findByText(/^no valuation$/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/^n\/a$/i)).length).toBeGreaterThan(0)
  })

})
