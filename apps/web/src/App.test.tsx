import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
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
                equityBenchmarkIndex: '100.00',
                inflationBenchmarkIndex: '100.00',
                targetMixBenchmarkIndex: '100.00',
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
                equityBenchmarkIndex: '101.30',
                inflationBenchmarkIndex: '100.20',
                targetMixBenchmarkIndex: '101.08',
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
                equityBenchmarkIndex: '102.40',
                inflationBenchmarkIndex: '100.40',
                targetMixBenchmarkIndex: '101.96',
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
    expect(screen.getByRole('link', { name: /^holdings$/i })).toBeInTheDocument()
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
    expect(await screen.findByText(/-0.48 pp/i)).toBeInTheDocument()
    expect(await screen.findByText(/inside the configured band/i)).toBeInTheDocument()
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
      <MemoryRouter initialEntries={['/holdings']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^holdings$/i })).toBeInTheDocument()
    expect(await screen.findByText(/valuation mode/i)).toBeInTheDocument()
    expect(await screen.findByText(/this view currently relies on book basis/i)).toBeInTheDocument()
    expect(await screen.findByText(/^no valuation$/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/^n\/a$/i)).length).toBeGreaterThan(0)
  })

  it('keeps the transaction journal in focus until the composer is opened explicitly', async () => {
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

      if (url.includes('/api/v1/accounts')) {
        return new Response(
          JSON.stringify([
            {
              id: 'acc-1',
              name: 'Primary',
              kind: 'BROKERAGE',
              currency: 'PLN',
              createdAt: '2026-03-13T12:00:00Z',
              updatedAt: '2026-03-13T12:00:00Z',
            },
          ]),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/instruments')) {
        return new Response(
          JSON.stringify([
            {
              id: 'ins-1',
              name: 'VWRA',
              symbol: 'VWRA.L',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              createdAt: '2026-03-13T12:00:00Z',
              updatedAt: '2026-03-13T12:00:00Z',
            },
          ]),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/transactions/import/profiles')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/audit/events')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/transactions')) {
        return new Response(
          JSON.stringify([
            {
              id: 'tx-1',
              accountId: 'acc-1',
              instrumentId: 'ins-1',
              type: 'BUY',
              tradeDate: '2026-03-10',
              settlementDate: '2026-03-12',
              quantity: '4',
              unitPrice: '100.00',
              grossAmount: '400.00',
              feeAmount: '0',
              taxAmount: '0',
              currency: 'USD',
              fxRateToPln: '3.95',
              notes: 'Initial buy',
              createdAt: '2026-03-10T12:00:00Z',
              updatedAt: '2026-03-10T12:00:00Z',
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in transactions journal test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^transactions$/i })).toBeInTheDocument()
    expect(await screen.findByText(/canonical transaction journal/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/gross amount/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }))

    expect(await screen.findByLabelText(/gross amount/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /close composer/i }).length).toBeGreaterThan(0)
  })

  it('shows a dashboard error state instead of empty onboarding when overview fails', async () => {
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

      if (url.includes('/api/v1/portfolio/overview')) {
        return new Response(JSON.stringify({ message: 'Overview unavailable' }), { status: 503 })
      }

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            points: [],
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

      if (url.includes('/api/v1/portfolio/read-model-refresh')) {
        return new Response(
          JSON.stringify({
            schedulerEnabled: false,
            intervalMinutes: 720,
            runOnStart: true,
            running: false,
            lastRunAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureMessage: null,
            lastTrigger: null,
            lastDurationMs: null,
            modelNames: ['DAILY_HISTORY', 'RETURNS'],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/read-model-cache')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in dashboard error test: ${url}`)
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

    expect(await screen.findByText(/dashboard unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/welcome to portfolio/i)).not.toBeInTheDocument()
  })

  it('opens and closes the mobile navigation drawer', async () => {
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

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            points: [],
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

      if (url.includes('/api/v1/portfolio/read-model-refresh')) {
        return new Response(
          JSON.stringify({
            schedulerEnabled: false,
            intervalMinutes: 720,
            runOnStart: true,
            running: false,
            lastRunAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureMessage: null,
            lastTrigger: null,
            lastDurationMs: null,
            modelNames: ['DAILY_HISTORY', 'RETURNS'],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/read-model-cache')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in navigation drawer test: ${url}`)
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

    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument()

    const openNavigationButtons = await screen.findAllByRole('button', { name: /open navigation/i })
    fireEvent.click(openNavigationButtons[0])

    expect(await screen.findByRole('dialog', { name: /navigation/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden')
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /navigation/i })).toHaveClass('-translate-x-full')
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument()
    })
  })

  it('scrolls to hash targets inside settings', async () => {
    const scrollIntoViewMock = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoViewMock

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

      if (url.includes('/api/v1/portfolio/allocation')) {
        return new Response(
          JSON.stringify({
            asOf: '2026-03-13',
            valuationState: 'MARK_TO_MARKET',
            configured: true,
            toleranceBandPctPoints: '5.00',
            rebalancingMode: 'CONTRIBUTIONS_ONLY',
            targetWeightSumPct: '100.00',
            totalCurrentValuePln: '2000.00',
            availableCashPln: '400.00',
            breachedBucketCount: 1,
            largestBandBreachPctPoints: '2.50',
            recommendedAction: 'DEPLOY_EXISTING_CASH',
            recommendedAssetClass: 'BONDS',
            recommendedContributionPln: '400.00',
            remainingContributionGapPln: '100.00',
            fullRebalanceBuyAmountPln: '500.00',
            fullRebalanceSellAmountPln: '500.00',
            requiresSelling: true,
            buckets: [],
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

      if (url.includes('/api/v1/portfolio/targets')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/overview')) {
        return new Response(
          JSON.stringify({
            asOf: '2026-03-13',
            valuationState: 'MARK_TO_MARKET',
            totalBookValuePln: '2000.00',
            totalCurrentValuePln: '2100.00',
            investedBookValuePln: '1600.00',
            investedCurrentValuePln: '1700.00',
            cashBalancePln: '400.00',
            netContributionsPln: '2000.00',
            equityBookValuePln: '1600.00',
            equityCurrentValuePln: '1700.00',
            bondBookValuePln: '0.00',
            bondCurrentValuePln: '0.00',
            cashBookValuePln: '400.00',
            cashCurrentValuePln: '400.00',
            totalUnrealizedGainPln: '100.00',
            accountCount: 1,
            instrumentCount: 1,
            activeHoldingCount: 1,
            valuedHoldingCount: 1,
            unvaluedHoldingCount: 0,
            valuationIssueCount: 0,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            from: '2026-01-01',
            until: '2026-03-13',
            valuationState: 'MARK_TO_MARKET',
            instrumentHistoryIssueCount: 0,
            referenceSeriesIssueCount: 0,
            benchmarkSeriesIssueCount: 0,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
            points: [
              {
                date: '2026-03-13',
                totalBookValuePln: '2000.00',
                totalCurrentValuePln: '2100.00',
                netContributionsPln: '2000.00',
                cashBalancePln: '400.00',
                totalCurrentValueUsd: '500.00',
                netContributionsUsd: '480.00',
                cashBalanceUsd: '95.00',
                totalCurrentValueAu: '1.10',
                netContributionsAu: '1.00',
                cashBalanceAu: '0.20',
                equityCurrentValuePln: '1700.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '400.00',
                equityAllocationPct: '80.95',
                bondAllocationPct: '0.00',
                cashAllocationPct: '19.05',
                portfolioPerformanceIndex: '1.05',
                equityBenchmarkIndex: '1.03',
                inflationBenchmarkIndex: '1.01',
                targetMixBenchmarkIndex: '1.02',
                activeHoldingCount: 1,
                valuedHoldingCount: 1,
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
            periods: [
              {
                key: 'MAX',
                label: 'MAX',
                requestedFrom: '2026-01-01',
                from: '2026-01-01',
                until: '2026-03-13',
                clippedToInception: false,
                dayCount: 72,
                nominalPln: {
                  moneyWeightedReturn: '0.05',
                  annualizedMoneyWeightedReturn: '0.05',
                  timeWeightedReturn: '0.05',
                  annualizedTimeWeightedReturn: '0.05',
                },
                nominalUsd: null,
                realPln: {
                  moneyWeightedReturn: '0.03',
                  annualizedMoneyWeightedReturn: '0.03',
                  timeWeightedReturn: '0.03',
                  annualizedTimeWeightedReturn: '0.03',
                },
                inflationFrom: '2026-01',
                inflationUntil: '2026-03',
                inflationMultiplier: '1.02',
                benchmarks: [
                  {
                    key: 'VWRA',
                    label: 'VWRA benchmark',
                    pinned: true,
                    nominalPln: {
                      moneyWeightedReturn: '0.04',
                      annualizedMoneyWeightedReturn: '0.04',
                      timeWeightedReturn: '0.04',
                      annualizedTimeWeightedReturn: '0.04',
                    },
                    excessTimeWeightedReturn: '0.01',
                    excessAnnualizedTimeWeightedReturn: '0.01',
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/accounts') || url.includes('/api/v1/instruments')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/state/export')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            exportedAt: '2026-03-13T12:00:00Z',
            accounts: [],
            instruments: [],
            targets: [],
            transactions: [],
          }),
          { status: 200 },
        )
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

      if (url.includes('/api/v1/portfolio/audit/events')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/read-model-cache')) {
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
      <MemoryRouter initialEntries={[{ pathname: '/settings', hash: '#targets' }]}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/target allocation|alokacja docelowa/i)).toBeInTheDocument()
    expect(await screen.findByText(/saved mix|zapisany miks/i)).toBeInTheDocument()
    expect(await screen.findByText(/no targets are saved yet|brak zapisanych targetów/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })

    Element.prototype.scrollIntoView = originalScrollIntoView
  })
})
