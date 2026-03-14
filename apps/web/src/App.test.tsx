import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
                  timeWeightedReturn: '0.0389',
                  annualizedTimeWeightedReturn: '0.2114',
                },
                nominalUsd: {
                  moneyWeightedReturn: '0.0381',
                  annualizedMoneyWeightedReturn: '0.2070',
                  timeWeightedReturn: '0.0350',
                  annualizedTimeWeightedReturn: '0.1902',
                },
                realPln: {
                  moneyWeightedReturn: '0.0198',
                  annualizedMoneyWeightedReturn: '0.1048',
                  timeWeightedReturn: '0.0176',
                  annualizedTimeWeightedReturn: '0.0935',
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

      if (url.includes('/api/v1/portfolio/allocation')) {
        return new Response(
          JSON.stringify({
            asOf: '2026-03-13',
            valuationState: 'MARK_TO_MARKET',
            configured: true,
            targetWeightSumPct: '100.00',
            totalCurrentValuePln: '2095.00',
            availableCashPln: '995.00',
            buckets: [
              {
                assetClass: 'EQUITIES',
                currentValuePln: '1100.00',
                currentWeightPct: '52.51',
                targetWeightPct: '80.00',
                targetValuePln: '1676.00',
                driftPctPoints: '-27.49',
                gapValuePln: '576.00',
                suggestedContributionPln: '576.00',
                status: 'UNDERWEIGHT',
              },
              {
                assetClass: 'BONDS',
                currentValuePln: '0.00',
                currentWeightPct: '0.00',
                targetWeightPct: '20.00',
                targetValuePln: '419.00',
                driftPctPoints: '-20.00',
                gapValuePln: '419.00',
                suggestedContributionPln: '419.00',
                status: 'UNDERWEIGHT',
              },
              {
                assetClass: 'CASH',
                currentValuePln: '995.00',
                currentWeightPct: '47.49',
                targetWeightPct: '0.00',
                targetValuePln: '0.00',
                driftPctPoints: '47.49',
                gapValuePln: '-995.00',
                suggestedContributionPln: '0.00',
                status: 'OVERWEIGHT',
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/targets')) {
        return new Response(
          JSON.stringify([
            {
              id: 'target-1',
              assetClass: 'EQUITIES',
              targetWeight: '0.80',
              createdAt: '2026-03-13T10:00:00Z',
              updatedAt: '2026-03-13T10:00:00Z',
            },
            {
              id: 'target-2',
              assetClass: 'BONDS',
              targetWeight: '0.20',
              createdAt: '2026-03-13T10:00:00Z',
              updatedAt: '2026-03-13T10:00:00Z',
            },
            {
              id: 'target-3',
              assetClass: 'CASH',
              targetWeight: '0.00',
              createdAt: '2026-03-13T10:00:00Z',
              updatedAt: '2026-03-13T10:00:00Z',
            },
          ]),
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
            lastRunAt: '2026-03-13T18:00:00Z',
            lastSuccessAt: '2026-03-13T18:00:00Z',
            lastFailureAt: null,
            lastFailureMessage: null,
            backups: [
              {
                fileName: 'portfolio-backup-20260313T180000000Z.json',
                createdAt: '2026-03-13T18:00:01Z',
                exportedAt: '2026-03-13T18:00:00Z',
                sizeBytes: 4096,
                schemaVersion: 1,
                accountCount: 1,
                instrumentCount: 1,
                transactionCount: 2,
                isReadable: true,
                errorMessage: null,
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
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument()
    expect((await screen.findAllByText(/portfolio dev/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/transactions remain the source of truth/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /portfolio overview/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /daily portfolio history/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /portfolio returns/i })).toBeInTheDocument()
    expect(await screen.findByText(/valuation state book_only/i)).toBeInTheDocument()
    expect(await screen.findByText(/^PLN MWRR$/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /inspect holdings/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /manage transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /check backups/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^holdings$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^backups$/i })).toBeInTheDocument()
  })
})
