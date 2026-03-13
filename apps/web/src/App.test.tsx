import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders dashboard shell with API data', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/meta')) {
        return new Response(
          JSON.stringify({
            name: 'Portfolio',
            stage: 'dev',
            version: '0.1.0-dev',
            stack: {
              web: 'React 19 + TypeScript + Vite',
              api: 'Kotlin 2.3 + Ktor 3',
              database: 'PostgreSQL (planned)',
            },
            capabilities: ['Transaction-based portfolio accounting'],
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
                key: 'YTD',
                label: 'YTD',
                requestedFrom: '2026-01-01',
                from: '2026-01-01',
                until: '2026-03-13',
                clippedToInception: false,
                dayCount: 71,
                nominalPln: {
                  moneyWeightedReturn: '0.0412',
                  annualizedMoneyWeightedReturn: '0.2263',
                },
                nominalUsd: {
                  moneyWeightedReturn: '0.0381',
                  annualizedMoneyWeightedReturn: '0.2070',
                },
                realPln: {
                  moneyWeightedReturn: '0.0198',
                  annualizedMoneyWeightedReturn: '0.1048',
                },
                inflationFrom: '2026-01',
                inflationUntil: '2026-03',
                inflationMultiplier: '1.021',
              },
            ],
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
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    expect(screen.getByText(/dashboard shell/i)).toBeInTheDocument()
    expect(await screen.findByText(/portfolio dev/i)).toBeInTheDocument()
    expect(screen.getByText(/transaction-based portfolio accounting/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /portfolio overview/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /daily portfolio history/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /money-weighted returns/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /holdings/i })).toBeInTheDocument()
    expect(screen.getByText(/valuation state/i)).toBeInTheDocument()
    expect(screen.getByText(/pln mwrr/i)).toBeInTheDocument()
    expect(screen.getByText(/vwce/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instruments/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /transaction journal/i })).toBeInTheDocument()
  })
})
