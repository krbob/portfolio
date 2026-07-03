import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../lib/i18n'
import { PerformanceScreen } from './PerformanceScreen'

function setLanguage(language: 'pl' | 'en') {
  const locale = language === 'pl' ? 'pl-PL' : 'en-GB'
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: locale,
  })
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: [locale],
  })
}

describe('PerformanceScreen', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('drives the benchmark chart from saved benchmark settings', async () => {
    setLanguage('pl')
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            from: '2026-01-01',
            until: '2026-03-27',
            valuationState: 'MARK_TO_MARKET',
            instrumentHistoryIssueCount: 0,
            referenceSeriesIssueCount: 0,
            benchmarkSeriesIssueCount: 0,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
            points: [
              {
                date: '2026-03-27',
                totalBookValuePln: '1000.00',
                totalCurrentValuePln: '1050.00',
                netContributionsPln: '1000.00',
                cashBalancePln: '150.00',
                totalCurrentValueUsd: '260.00',
                netContributionsUsd: '250.00',
                cashBalanceUsd: '35.00',
                totalCurrentValueAu: null,
                netContributionsAu: null,
                cashBalanceAu: null,
                equityCurrentValuePln: '900.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '150.00',
                equityAllocationPct: '85.71',
                bondAllocationPct: '0.00',
                cashAllocationPct: '14.29',
                portfolioPerformanceIndex: '1.05',
                benchmarkIndices: {
                  CUSTOM_1: '1.04',
                  VWRA: '1.03',
                  TARGET_MIX: '1.02',
                },
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
            asOf: '2026-03-27',
            periods: [],
            rollingReturns: [],
            drawdowns: {
              current: null,
              max: null,
              observations: [],
              episodes: [],
            },
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/benchmark-settings')) {
        return new Response(
          JSON.stringify({
            enabledKeys: ['CUSTOM_1', 'VWRA'],
            pinnedKeys: ['CUSTOM_1'],
            customBenchmarks: [
              {
                key: 'CUSTOM_1',
                label: 'Europa 600',
                symbol: 'EXSA.DE',
              },
            ],
            options: [
              {
                key: 'VWRA',
                label: 'VWRA benchmark',
                symbol: 'VWRA.L',
                kind: 'ETF',
                configurable: true,
                defaultEnabled: true,
                defaultPinned: true,
              },
              {
                key: 'TARGET_MIX',
                label: 'Configured target mix',
                symbol: null,
                kind: 'SYSTEM',
                configurable: false,
                defaultEnabled: true,
                defaultPinned: false,
              },
              {
                key: 'CUSTOM_1',
                label: 'Europa 600',
                symbol: 'EXSA.DE',
                kind: 'CUSTOM',
                configurable: true,
                defaultEnabled: false,
                defaultPinned: false,
              },
            ],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in PerformanceScreen test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <PerformanceScreen />
          </I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    const select = (await screen.findByLabelText('Wybierz benchmark')) as HTMLSelectElement

    await waitFor(() => {
      expect(select.value).toBe('CUSTOM_1')
    })

    expect(screen.getByRole('option', { name: 'Europa 600' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /miks docelowy/i })).not.toBeInTheDocument()
  })

  it('renders rolling returns and drawdowns on the returns tab', async () => {
    setLanguage('pl')
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/portfolio/overview')) {
        return new Response(JSON.stringify({ totalCurrentValuePln: '1140.00' }), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            from: '2025-03-27',
            until: '2026-03-27',
            valuationState: 'MARK_TO_MARKET',
            instrumentHistoryIssueCount: 0,
            referenceSeriesIssueCount: 0,
            benchmarkSeriesIssueCount: 0,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
            points: [
              {
                date: '2026-03-27',
                totalBookValuePln: '1000.00',
                totalCurrentValuePln: '1140.00',
                netContributionsPln: '1000.00',
                cashBalancePln: '140.00',
                totalCurrentValueUsd: null,
                netContributionsUsd: null,
                cashBalanceUsd: null,
                totalCurrentValueAu: null,
                netContributionsAu: null,
                cashBalanceAu: null,
                equityCurrentValuePln: '1000.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '140.00',
                equityAllocationPct: '87.72',
                bondAllocationPct: '0.00',
                cashAllocationPct: '12.28',
                portfolioPerformanceIndex: '114.0000',
                benchmarkIndices: {},
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
            asOf: '2026-03-27',
            periods: [
              {
                key: 'MAX',
                label: 'MAX',
                requestedFrom: '2025-03-27',
                from: '2025-03-27',
                until: '2026-03-27',
                clippedToInception: false,
                dayCount: 365,
                nominalPln: {
                  moneyWeightedReturn: '0.14',
                  annualizedMoneyWeightedReturn: '0.14',
                  timeWeightedReturn: '0.14',
                  annualizedTimeWeightedReturn: '0.14',
                },
                nominalUsd: null,
                realPln: null,
                inflationFrom: null,
                inflationUntil: null,
                inflationMultiplier: null,
                breakdown: null,
                benchmarks: [],
              },
            ],
            rollingReturns: [
              {
                key: 'ONE_YEAR',
                label: '1Y rolling TWR',
                years: 1,
                observationCount: 2,
                latest: {
                  from: '2025-03-27',
                  until: '2026-03-27',
                  dayCount: 365,
                  totalReturn: '0.12',
                  annualizedReturn: '0.12',
                },
                best: {
                  from: '2025-03-27',
                  until: '2026-03-27',
                  dayCount: 365,
                  totalReturn: '0.12',
                  annualizedReturn: '0.12',
                },
                worst: {
                  from: '2025-04-01',
                  until: '2026-04-01',
                  dayCount: 365,
                  totalReturn: '-0.04',
                  annualizedReturn: '-0.04',
                },
                observations: [],
              },
            ],
            drawdowns: {
              current: {
                date: '2026-03-27',
                peakDate: '2026-02-01',
                peakIndex: '120.0000',
                index: '114.0000',
                drawdown: '-0.05',
              },
              max: {
                date: '2026-01-15',
                peakDate: '2025-12-01',
                peakIndex: '125.0000',
                index: '102.5000',
                drawdown: '-0.18',
              },
              observations: [],
              episodes: [
                {
                  peakDate: '2025-12-01',
                  startDate: '2025-12-05',
                  troughDate: '2026-01-15',
                  recoveredDate: '2026-03-10',
                  depth: '-0.18',
                  durationDays: 95,
                  recoveryDays: 54,
                  status: 'RECOVERED',
                },
              ],
            },
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/portfolio/benchmark-settings')) {
        return new Response(
          JSON.stringify({
            enabledKeys: [],
            pinnedKeys: [],
            customBenchmarks: [],
            options: [],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in PerformanceScreen test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <PerformanceScreen />
          </I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Zwroty' }))

    expect(await screen.findByText('Rolling TWR i obsunięcia')).toBeInTheDocument()
    expect(screen.getByText('1Y rolling TWR')).toBeInTheDocument()
    expect(screen.getAllByText('+12,00%').length).toBeGreaterThan(0)
    expect(screen.getByText('Maksymalne')).toBeInTheDocument()
    expect(screen.getAllByText('-18,00%').length).toBeGreaterThan(0)
  })
})
