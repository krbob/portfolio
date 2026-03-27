import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  it('renders account summaries on the dedicated accounts screen', async () => {
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
              totalCurrentValuePln: '2195.00',
              investedBookValuePln: '1005.00',
              investedCurrentValuePln: '1200.00',
              cashBalancePln: '995.00',
              cashBalances: [
                { currency: 'PLN', amount: '700.00', bookValuePln: '700.00' },
                { currency: 'USD', amount: '75.00', bookValuePln: '295.00' },
              ],
              netContributionsPln: '2000.00',
              netContributionBalances: [
                { currency: 'PLN', amount: '1500.00', bookValuePln: '1500.00' },
                { currency: 'USD', amount: '125.00', bookValuePln: '500.00' },
              ],
              totalUnrealizedGainPln: '195.00',
              portfolioWeightPct: '81.45',
              activeHoldingCount: 1,
              valuedHoldingCount: 1,
              valuationIssueCount: 0,
            },
            {
              accountId: 'acc-2',
              accountName: 'Reserve',
              institution: 'Bank',
              type: 'CASH',
              baseCurrency: 'PLN',
              valuationState: 'MARK_TO_MARKET',
              totalBookValuePln: '500.00',
              totalCurrentValuePln: '500.00',
              investedBookValuePln: '0.00',
              investedCurrentValuePln: '0.00',
              cashBalancePln: '500.00',
              cashBalances: [{ currency: 'PLN', amount: '500.00', bookValuePln: '500.00' }],
              netContributionsPln: '500.00',
              netContributionBalances: [{ currency: 'PLN', amount: '500.00', bookValuePln: '500.00' }],
              totalUnrealizedGainPln: '0.00',
              portfolioWeightPct: '18.55',
              activeHoldingCount: 0,
              valuedHoldingCount: 0,
              valuationIssueCount: 0,
            },
          ]),
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
              instrumentName: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              quantity: '10',
              averageCostPerUnitPln: '100.50',
              costBasisPln: '1005.00',
              bookValuePln: '1005.00',
              currentPricePln: '120.00',
              currentValuePln: '1200.00',
              unrealizedGainPln: '195.00',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 2,
            },
          ]),
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/accounts')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in accounts screen test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByRole('heading', { name: /^accounts$/i })).length).toBeGreaterThan(0)
    expect(await screen.findByText(/account overview/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/primary/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/reserve/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/cash on accounts/i)).toBeInTheDocument()
    expect(await screen.findByText(/81.45% of portfolio/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/\+.*195/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/top positions/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/largest line/i)).length).toBeGreaterThan(0)
    const nativeCashBalancesHeading = await screen.findByText(/native cash balances/i)
    const nativeCashBalancesCard = nativeCashBalancesHeading.closest('div')
    expect(nativeCashBalancesCard).not.toBeNull()
    expect(within(nativeCashBalancesCard as HTMLElement).getByText(/^USD$/i)).toBeInTheDocument()

    const netContributionsByCurrencyHeading = await screen.findByText(/net contributions by currency/i)
    const netContributionsByCurrencyCard = netContributionsByCurrencyHeading.closest('div')
    expect(netContributionsByCurrencyCard).not.toBeNull()
    expect(within(netContributionsByCurrencyCard as HTMLElement).getByText(/^USD$/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByText(/^reserve$/i))

    expect(await screen.findByText(/has no active positions yet/i)).toBeInTheDocument()
  })

  it('renders instrument summaries on the dedicated instruments screen', async () => {
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
              instrumentName: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              quantity: '10',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '1000.00',
              bookValuePln: '1000.00',
              currentPricePln: '112.50',
              currentValuePln: '1125.00',
              unrealizedGainPln: '125.00',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 2,
            },
            {
              accountId: 'acc-2',
              accountName: 'Reserve',
              instrumentId: 'ins-1',
              instrumentName: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              quantity: '5',
              averageCostPerUnitPln: '102.00',
              costBasisPln: '510.00',
              bookValuePln: '510.00',
              currentPricePln: '112.50',
              currentValuePln: '562.50',
              unrealizedGainPln: '52.50',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 1,
            },
            {
              accountId: 'acc-1',
              accountName: 'Primary',
              instrumentId: 'ins-2',
              instrumentName: 'EDO0336',
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              currency: 'PLN',
              quantity: '70',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '7000.00',
              bookValuePln: '7000.00',
              currentPricePln: '101.37',
              currentValuePln: '7095.90',
              unrealizedGainPln: '95.90',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 1,
              edoLots: [
                {
                  purchaseDate: '2026-03-03',
                  quantity: '70',
                  costBasisPln: '7000.00',
                  currentPricePln: '101.37',
                  currentValuePln: '7095.90',
                  unrealizedGainPln: '95.90',
                  valuedAt: '2026-03-20',
                  valuationStatus: 'VALUED',
                  valuationIssue: null,
                },
              ],
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
              kind: 'ETF',
              assetClass: 'EQUITIES',
              symbol: 'VWRA.L',
              currency: 'USD',
              valuationSource: 'STOCK_ANALYST',
              edoTerms: null,
              isActive: true,
              createdAt: '2026-03-01T00:00:00Z',
              updatedAt: '2026-03-01T00:00:00Z',
            },
            {
              id: 'ins-2',
              name: 'EDO0336',
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              symbol: null,
              currency: 'PLN',
              valuationSource: 'EDO_CALCULATOR',
              edoTerms: {
                seriesMonth: '2026-03',
                firstPeriodRateBps: 500,
                marginBps: 150,
              },
              isActive: true,
              createdAt: '2026-03-02T00:00:00Z',
              updatedAt: '2026-03-02T00:00:00Z',
            },
            {
              id: 'ins-3',
              name: 'SGOV',
              kind: 'ETF',
              assetClass: 'BONDS',
              symbol: 'SGOV',
              currency: 'USD',
              valuationSource: 'STOCK_ANALYST',
              edoTerms: null,
              isActive: true,
              createdAt: '2026-03-03T00:00:00Z',
              updatedAt: '2026-03-03T00:00:00Z',
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in instruments screen test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/instruments']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByRole('heading', { name: /^instruments$/i })).length).toBeGreaterThan(0)
    expect(await screen.findByText(/instrument overview/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/vwra/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/edo0336/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/sgov/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/catalog only/i)).toBeInTheDocument()
    expect(await screen.findByText(/2 active in portfolio/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/\+.*273.40/i)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/edo lots/i)).toBeInTheDocument()

    fireEvent.click((await screen.findAllByText(/^vwra$/i))[0]!)

    expect(await screen.findByText(/account split/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/reserve/i)).length).toBeGreaterThan(0)
  })

  it('shows n/a for instrument pnl when live pricing is unavailable', async () => {
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
              instrumentName: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              quantity: '10',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '1000.00',
              bookValuePln: '1000.00',
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

      if (url.includes('/api/v1/instruments')) {
        return new Response(
          JSON.stringify([
            {
              id: 'ins-1',
              name: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              symbol: 'VWRA.L',
              currency: 'USD',
              valuationSource: 'STOCK_ANALYST',
              edoTerms: null,
              isActive: true,
              createdAt: '2026-03-01T00:00:00Z',
              updatedAt: '2026-03-01T00:00:00Z',
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in instrument book-basis test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/instruments']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByRole('heading', { name: /^instruments$/i })).length).toBeGreaterThan(0)
    expect(await screen.findByText(/no market valuation for active holdings/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/^n\/a$/i)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/book basis/i)).length).toBeGreaterThan(0)
  })

  it('does not fake zero pnl in account holding previews when gain payload is missing', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return new Response(JSON.stringify({ authEnabled: false, authenticated: true, mode: 'DISABLED' }), { status: 200 })
      }

      if (url.includes('/api/v1/meta')) {
        return new Response(JSON.stringify({
          name: 'Portfolio',
          stage: 'dev',
          version: '0.1.0-dev',
          auth: { enabled: false, mode: 'DISABLED' },
          stack: {
            web: 'React 19 + TypeScript + Vite',
            api: 'Kotlin 2.3 + Ktor 3',
            database: 'SQLite',
          },
          capabilities: ['Transaction-based portfolio accounting'],
        }), { status: 200 })
      }

      if (url.includes('/api/v1/readiness')) {
        return new Response(JSON.stringify({ status: 'READY', checkedAt: '2026-03-13T12:00:00Z', checks: [] }), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/accounts')) {
        return new Response(JSON.stringify([
          {
            accountId: 'acc-1',
            accountName: 'Primary',
            institution: 'Broker',
            type: 'BROKERAGE',
            baseCurrency: 'PLN',
            valuationState: 'MARK_TO_MARKET',
            totalBookValuePln: '2000.00',
            totalCurrentValuePln: '2200.00',
            investedBookValuePln: '1000.00',
            investedCurrentValuePln: '1200.00',
            cashBalancePln: '1000.00',
            cashBalances: [{ currency: 'PLN', amount: '1000.00', bookValuePln: '1000.00' }],
            netContributionsPln: '2000.00',
            netContributionBalances: [{ currency: 'PLN', amount: '2000.00', bookValuePln: '2000.00' }],
            totalUnrealizedGainPln: '200.00',
            portfolioWeightPct: '100.00',
            activeHoldingCount: 1,
            valuedHoldingCount: 1,
            valuationIssueCount: 0,
          },
        ]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(JSON.stringify([
          {
            accountId: 'acc-1',
            accountName: 'Primary',
            instrumentId: 'ins-1',
            instrumentName: 'VWRA',
            kind: 'ETF',
            assetClass: 'EQUITIES',
            currency: 'USD',
            quantity: '10.0000',
            averageCostPerUnitPln: '100.00',
            costBasisPln: '1000.00',
            bookValuePln: '1000.00',
            currentPricePln: '120.00',
            currentValuePln: '1200.00',
            unrealizedGainPln: null,
            valuedAt: '2026-03-20',
            valuationStatus: 'VALUED',
            valuationIssue: null,
            transactionCount: 2,
          },
        ]), { status: 200 })
      }

      if (url.includes('/api/v1/accounts')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in account holding preview test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByRole('heading', { name: /^accounts$/i })).length).toBeGreaterThan(0)
    const holdingTitle = (await screen.findAllByText(/^VWRA$/i))[0]!
    const holdingCard = holdingTitle.closest('div')?.parentElement
    expect(holdingCard).not.toBeNull()
    expect(within(holdingCard as HTMLElement).getByText(/n\/a/i)).toBeInTheDocument()
    expect(within(holdingCard as HTMLElement).queryByText(/\+.*0(\.00)?/i)).not.toBeInTheDocument()
    expect(within(holdingCard as HTMLElement).getByText(/10 units/i)).toBeInTheDocument()
  })

  it('does not fake zero pnl in instrument account splits when gain payload is missing', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return new Response(JSON.stringify({ authEnabled: false, authenticated: true, mode: 'DISABLED' }), { status: 200 })
      }

      if (url.includes('/api/v1/meta')) {
        return new Response(JSON.stringify({
          name: 'Portfolio',
          stage: 'dev',
          version: '0.1.0-dev',
          auth: { enabled: false, mode: 'DISABLED' },
          stack: {
            web: 'React 19 + TypeScript + Vite',
            api: 'Kotlin 2.3 + Ktor 3',
            database: 'SQLite',
          },
          capabilities: ['Transaction-based portfolio accounting'],
        }), { status: 200 })
      }

      if (url.includes('/api/v1/readiness')) {
        return new Response(JSON.stringify({ status: 'READY', checkedAt: '2026-03-13T12:00:00Z', checks: [] }), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(JSON.stringify([
          {
            accountId: 'acc-1',
            accountName: 'Primary',
            instrumentId: 'ins-1',
            instrumentName: 'VWRA',
            kind: 'ETF',
            assetClass: 'EQUITIES',
            currency: 'USD',
            quantity: '10.0000',
            averageCostPerUnitPln: '100.00',
            costBasisPln: '1000.00',
            bookValuePln: '1000.00',
            currentPricePln: '120.00',
            currentValuePln: '1200.00',
            unrealizedGainPln: null,
            valuedAt: '2026-03-20',
            valuationStatus: 'VALUED',
            valuationIssue: null,
            transactionCount: 2,
          },
        ]), { status: 200 })
      }

      if (url.includes('/api/v1/instruments')) {
        return new Response(JSON.stringify([
          {
            id: 'ins-1',
            name: 'VWRA',
            kind: 'ETF',
            assetClass: 'EQUITIES',
            symbol: 'VWRA.L',
            currency: 'USD',
            valuationSource: 'STOCK_ANALYST',
            edoTerms: null,
            isActive: true,
            createdAt: '2026-03-01T00:00:00Z',
            updatedAt: '2026-03-01T00:00:00Z',
          },
        ]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in instrument holding preview test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/instruments']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByRole('heading', { name: /^instruments$/i })).length).toBeGreaterThan(0)
    const accountName = (await screen.findAllByText(/^Primary$/i))[0]!
    const holdingCard = accountName.closest('div')?.parentElement
    expect(holdingCard).not.toBeNull()
    expect(within(holdingCard as HTMLElement).getByText(/n\/a/i)).toBeInTheDocument()
    expect(within(holdingCard as HTMLElement).queryByText(/\+.*0(\.00)?/i)).not.toBeInTheDocument()
    expect(within(holdingCard as HTMLElement).getByText(/10 units/i)).toBeInTheDocument()
  })

  it('sorts instrument rows and rounds displayed quantities', async () => {
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
              instrumentName: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              quantity: '10.125',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '1012.50',
              bookValuePln: '1012.50',
              currentPricePln: '112.50',
              currentValuePln: '1139.06',
              unrealizedGainPln: '126.56',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 2,
            },
            {
              accountId: 'acc-1',
              accountName: 'Primary',
              instrumentId: 'ins-2',
              instrumentName: 'EDO0336',
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              currency: 'PLN',
              quantity: '4',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '400.00',
              bookValuePln: '400.00',
              currentPricePln: '101.37',
              currentValuePln: '405.48',
              unrealizedGainPln: '5.48',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 1,
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
              kind: 'ETF',
              assetClass: 'EQUITIES',
              symbol: 'VWRA.L',
              currency: 'USD',
              valuationSource: 'STOCK_ANALYST',
              edoTerms: null,
              isActive: true,
              createdAt: '2026-03-01T00:00:00Z',
              updatedAt: '2026-03-01T00:00:00Z',
            },
            {
              id: 'ins-2',
              name: 'EDO0336',
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              symbol: null,
              currency: 'PLN',
              valuationSource: 'EDO_CALCULATOR',
              edoTerms: {
                seriesMonth: '2026-03',
                firstPeriodRateBps: 500,
                marginBps: 150,
              },
              isActive: true,
              createdAt: '2026-03-02T00:00:00Z',
              updatedAt: '2026-03-02T00:00:00Z',
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in instrument sorting test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const view = render(
      <MemoryRouter initialEntries={['/instruments']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('10.13')).toBeInTheDocument()
    expect(screen.queryByText('10.1250')).not.toBeInTheDocument()

    const quantityToggle = screen.getAllByRole('button', { name: /^quantity/i })[0]!
    fireEvent.click(quantityToggle)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const vwraRow = rows.find((row) => within(row).queryByText('VWRA'))
      const edoRow = rows.find((row) => within(row).queryByText('EDO0336'))

      expect(vwraRow).toBeDefined()
      expect(edoRow).toBeDefined()
      expect(rows.indexOf(vwraRow!)).toBeLessThan(rows.indexOf(edoRow!))
    })

    view.unmount()

    const persistedQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/instruments']}>
        <QueryClientProvider client={persistedQueryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const vwraRow = rows.find((row) => within(row).queryByText('VWRA'))
      const edoRow = rows.find((row) => within(row).queryByText('EDO0336'))

      expect(vwraRow).toBeDefined()
      expect(edoRow).toBeDefined()
      expect(rows.indexOf(vwraRow!)).toBeLessThan(rows.indexOf(edoRow!))
    })
  })

  it('restores persisted holdings filters from local storage', async () => {
    window.localStorage.setItem('portfolio:view:holdings:account-filter', JSON.stringify('Reserve'))
    window.localStorage.setItem('portfolio:view:holdings:asset-class-filter', JSON.stringify('ALL'))
    window.localStorage.setItem('portfolio:view:holdings:status-filter', JSON.stringify('ALL'))
    window.localStorage.setItem('portfolio:view:holdings:search-query', JSON.stringify(''))
    window.localStorage.setItem(
      'portfolio:view:holdings:sort-state',
      JSON.stringify({ field: 'instrumentName', direction: 'asc' }),
    )

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
            buildHoldingFixture('acc-primary', 'Primary', 'ins-1', 'Alpha Growth'),
            buildHoldingFixture('acc-primary', 'Primary', 'ins-2', 'Bravo Equity'),
            buildHoldingFixture('acc-primary', 'Primary', 'ins-3', 'Charlie Income'),
            buildHoldingFixture('acc-reserve', 'Reserve', 'ins-4', 'Delta Bonds'),
            buildHoldingFixture('acc-reserve', 'Reserve', 'ins-5', 'Echo Value'),
            buildHoldingFixture('acc-reserve', 'Reserve', 'ins-6', 'Foxtrot Cash'),
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in holdings persistence test: ${url}`)
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
    expect(await screen.findByText('Delta Bonds')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Growth')).not.toBeInTheDocument()
  })

  it('shows percentage pnl for valued holdings', async () => {
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
              instrumentName: 'VWRA',
              kind: 'ETF',
              assetClass: 'EQUITIES',
              currency: 'USD',
              quantity: '10',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '1000.00',
              bookValuePln: '1000.00',
              currentPricePln: '112.50',
              currentValuePln: '1125.00',
              unrealizedGainPln: '125.00',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 1,
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in holdings pnl test: ${url}`)
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
    expect(await screen.findByText('+12.50%')).toBeInTheDocument()

    const vwraRow = (await screen.findAllByRole('row')).find((row) => within(row).queryByText('VWRA'))

    expect(vwraRow).toBeDefined()
    fireEvent.click(vwraRow!)

    expect((await screen.findAllByText(/\+.*125\.00/)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('+12.50%')).length).toBeGreaterThan(0)
  })

})

function buildHoldingFixture(accountId: string, accountName: string, instrumentId: string, instrumentName: string) {
  return {
    accountId,
    accountName,
    instrumentId,
    instrumentName,
    kind: 'ETF',
    assetClass: 'EQUITIES',
    currency: 'USD',
    quantity: '5',
    averageCostPerUnitPln: '100.00',
    costBasisPln: '500.00',
    bookValuePln: '500.00',
    currentPricePln: '110.00',
    currentValuePln: '550.00',
    unrealizedGainPln: '50.00',
    valuedAt: '2026-03-20',
    valuationStatus: 'VALUED',
    valuationIssue: null,
    transactionCount: 1,
  }
}
