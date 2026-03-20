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
            valuationState: 'MARK_TO_MARKET',
            instrumentHistoryIssueCount: 0,
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
                totalCurrentValuePln: '2045.00',
                netContributionsPln: '2000.00',
                cashBalancePln: '995.00',
                totalCurrentValueUsd: '511.25',
                netContributionsUsd: '500.00',
                cashBalanceUsd: '248.75',
                totalCurrentValueAu: '0.168313',
                netContributionsAu: '0.164609',
                cashBalanceAu: '0.081893',
                equityCurrentValuePln: '1050.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '995.00',
                equityAllocationPct: '51.34',
                bondAllocationPct: '0.00',
                cashAllocationPct: '48.66',
                portfolioPerformanceIndex: '102.25',
                equityBenchmarkIndex: '101.30',
                inflationBenchmarkIndex: '100.20',
                targetMixBenchmarkIndex: '101.08',
                activeHoldingCount: 1,
                valuedHoldingCount: 1,
              },
              {
                date: '2026-03-03',
                totalBookValuePln: '2000.00',
                totalCurrentValuePln: '2095.00',
                netContributionsPln: '2000.00',
                cashBalancePln: '995.00',
                totalCurrentValueUsd: '510.98',
                netContributionsUsd: '487.80',
                cashBalanceUsd: '242.68',
                totalCurrentValueAu: '0.173140',
                netContributionsAu: '0.165289',
                cashBalanceAu: '0.082231',
                equityCurrentValuePln: '1100.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '995.00',
                equityAllocationPct: '52.51',
                bondAllocationPct: '0.00',
                cashAllocationPct: '47.49',
                portfolioPerformanceIndex: '104.75',
                equityBenchmarkIndex: '102.40',
                inflationBenchmarkIndex: '100.40',
                targetMixBenchmarkIndex: '101.96',
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
            breachedBucketCount: 1,
            largestBandBreachPctPoints: '3.40',
            recommendedAction: 'DEPLOY_EXISTING_CASH',
            recommendedAssetClass: 'BONDS',
            recommendedContributionPln: '995.00',
            remainingContributionGapPln: '105.00',
            fullRebalanceBuyAmountPln: '1100.00',
            fullRebalanceSellAmountPln: '1100.00',
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
    expect(await screen.findByText(/total value/i)).toBeInTheDocument()
    expect(await screen.findByText(/daily change/i)).toBeInTheDocument()
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

      if (url.includes('/api/v1/portfolio/targets')) {
        return new Response(JSON.stringify([]), { status: 200 })
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

    expect(await screen.findByRole('heading', { name: /settings|ustawienia/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })

    Element.prototype.scrollIntoView = originalScrollIntoView
  })
})
