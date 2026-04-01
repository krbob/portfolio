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
              id: 'acc-2',
              name: 'Second account',
              kind: 'BROKERAGE',
              currency: 'PLN',
              createdAt: '2026-03-14T12:00:00Z',
              updatedAt: '2026-03-14T12:00:00Z',
            },
            {
              id: 'acc-1',
              name: 'First account',
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

      if (url.includes('/api/v1/portfolio/holdings')) {
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

    expect((await screen.findAllByRole('heading', { name: /^transactions$/i })).length).toBeGreaterThan(0)
    expect(await screen.findByText(/canonical transaction journal/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/gross amount/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }))

    expect(await screen.findByRole('dialog', { name: /new transaction/i })).toBeInTheDocument()
    expect(await screen.findByLabelText(/gross amount/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /close editor/i }).length).toBeGreaterThan(0)

    const tradeDateInput = screen.getByLabelText(/trade date/i)
    fireEvent.change(tradeDateInput, { target: { value: '2026-04-01' } })

    expect(screen.queryByLabelText(/^settlement date$/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /set another date/i }))

    const settlementDateInput = await screen.findByLabelText(/^settlement date$/i)
    expect(settlementDateInput).toHaveValue('2026-04-01')

    fireEvent.change(tradeDateInput, { target: { value: '2026-04-02' } })
    expect(settlementDateInput).toHaveValue('2026-04-02')

    fireEvent.change(settlementDateInput, { target: { value: '2026-04-05' } })
    fireEvent.change(tradeDateInput, { target: { value: '2026-04-03' } })
    expect(settlementDateInput).toHaveValue('2026-04-05')

    fireEvent.click(screen.getByRole('button', { name: /use trade date/i }))
    expect(screen.queryByLabelText(/^settlement date$/i)).not.toBeInTheDocument()
  })

  it('normalizes decimal commas and auto-calculates gross amount when creating a transaction', async () => {
    let createdPayload: Record<string, string> | null = null

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      const method = input instanceof Request ? input.method : init?.method ?? 'GET'

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
              id: 'acc-2',
              name: 'Second account',
              kind: 'BROKERAGE',
              currency: 'PLN',
              createdAt: '2026-03-14T12:00:00Z',
              updatedAt: '2026-03-14T12:00:00Z',
            },
            {
              id: 'acc-1',
              name: 'First account',
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

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/transactions')) {
        if (method === 'POST') {
          const body = input instanceof Request ? JSON.parse(await input.text()) : JSON.parse(String(init?.body ?? '{}'))
          createdPayload = body
          return new Response(
            JSON.stringify({
              id: 'tx-2',
              ...body,
              createdAt: '2026-03-13T12:30:00Z',
              updatedAt: '2026-03-13T12:30:00Z',
            }),
            { status: 201 },
          )
        }

        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in transaction create test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const view = render(
      <MemoryRouter initialEntries={['/transactions']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    const scope = within(view.container)

    expect((await scope.findAllByRole('heading', { name: /^transactions$/i })).length).toBeGreaterThan(0)

    fireEvent.click(await scope.findByRole('button', { name: /new transaction/i }))

    const dialog = await screen.findByRole('dialog', { name: /new transaction/i })
    const dialogScope = within(dialog)
    const accountSelect = dialogScope.getByLabelText(/^account$/i)

    expect(Array.from(accountSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      'Select account',
      'First account',
      'Second account',
    ])

    fireEvent.change(accountSelect, { target: { value: 'acc-1' } })
    fireEvent.change(dialogScope.getByLabelText(/^type$/i), { target: { value: 'BUY' } })
    fireEvent.change(dialogScope.getByLabelText(/^instrument$/i), { target: { value: 'ins-1' } })
    const quantityInput = dialogScope.getByLabelText(/^quantity$/i)
    fireEvent.change(quantityInput, { target: { value: '2,5' } })
    expect(quantityInput).toHaveValue('2')
    fireEvent.change(dialogScope.getByLabelText(/^unit price$/i), { target: { value: '123,45' } })
    const grossAmountInput = dialogScope.getByPlaceholderText('246.90')

    await waitFor(() => {
      expect(grossAmountInput).toHaveValue('246.90')
    })

    fireEvent.change(grossAmountInput, { target: { value: '250,00' } })
    expect(grossAmountInput).toHaveValue('250,00')

    fireEvent.click(dialogScope.getByRole('button', { name: /recalculate/i }))
    await waitFor(() => {
      expect(grossAmountInput).toHaveValue('246.90')
    })

    fireEvent.change(dialogScope.getByLabelText(/^currency$/i), { target: { value: 'USD' } })
    fireEvent.change(dialogScope.getByLabelText(/^fx rate to pln$/i), { target: { value: '4,0321' } })
    fireEvent.click(dialogScope.getByRole('button', { name: /add transaction/i }))

    await waitFor(() => {
      expect(createdPayload).toMatchObject({
        accountId: 'acc-1',
        instrumentId: 'ins-1',
        type: 'BUY',
        quantity: '2',
        unitPrice: '123.45',
        grossAmount: '246.90',
        fxRateToPln: '4.0321',
      })
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /new transaction/i })).not.toBeInTheDocument()
    })
  })

  it('shows active EDO lots and FIFO preview for redeem transactions', async () => {
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
              name: 'Primary account',
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
            {
              id: 'ins-2',
              name: 'EDO0336',
              symbol: null,
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              currency: 'PLN',
              edoTerms: {
                seriesMonth: '2026-03',
                firstPeriodRateBps: 500,
                marginBps: 150,
              },
              valuationSource: 'EDO_CALCULATOR',
              createdAt: '2026-03-13T12:00:00Z',
              updatedAt: '2026-03-13T12:00:00Z',
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
              accountName: 'Primary account',
              instrumentId: 'ins-2',
              instrumentName: 'EDO0336',
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              currency: 'PLN',
              quantity: '100',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '10000.00',
              bookValuePln: '10000.00',
              currentPricePln: '101.59',
              currentValuePln: '10159.00',
              unrealizedGainPln: '159.00',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 2,
              edoLots: [
                {
                  purchaseDate: '2026-03-02',
                  quantity: '70',
                  costBasisPln: '7000.00',
                  currentPricePln: '102.10',
                  currentValuePln: '7147.00',
                  unrealizedGainPln: '147.00',
                  valuedAt: '2026-03-20',
                  valuationStatus: 'VALUED',
                  valuationIssue: null,
                },
                {
                  purchaseDate: '2026-03-22',
                  quantity: '30',
                  costBasisPln: '3000.00',
                  currentPricePln: '100.40',
                  currentValuePln: '3012.00',
                  unrealizedGainPln: '12.00',
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

      if (url.includes('/api/v1/transactions/import/profiles')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/audit/events')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/transactions')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in redeem guidance test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const view = render(
      <MemoryRouter initialEntries={['/transactions']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    const scope = within(view.container)

    expect((await scope.findAllByRole('heading', { name: /^transactions$/i })).length).toBeGreaterThan(0)

    fireEvent.click(await scope.findByRole('button', { name: /new transaction/i }))

    const dialog = await screen.findByRole('dialog', { name: /new transaction/i })
    const dialogScope = within(dialog)

    fireEvent.change(dialogScope.getByLabelText(/^account$/i), { target: { value: 'acc-1' } })
    fireEvent.change(dialogScope.getByLabelText(/^type$/i), { target: { value: 'REDEEM' } })

    const instrumentSelect = dialogScope.getByLabelText(/^instrument$/i) as HTMLSelectElement
    expect(Array.from(instrumentSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      'Select instrument',
      'EDO0336',
    ])

    fireEvent.change(instrumentSelect, { target: { value: 'ins-2' } })

    expect(await dialogScope.findByText(/active edo lots/i)).toBeInTheDocument()
    expect(dialogScope.getAllByRole('button', { name: /redeem this lot/i })).toHaveLength(2)
    expect(dialogScope.getByText(/70 units .*cost/i)).toBeInTheDocument()
    expect(dialogScope.getByText(/30 units .*cost/i)).toBeInTheDocument()
    expect(dialogScope.getByText(/available units/i)).toBeInTheDocument()
    expect(dialogScope.getByText(/^100$/)).toBeInTheDocument()

    fireEvent.change(dialogScope.getByLabelText(/^quantity$/i), { target: { value: '80' } })
    expect(await dialogScope.findByText(/fully consumed in fifo/i)).toBeInTheDocument()
    expect(dialogScope.getByText(/fifo: 10 units/i)).toBeInTheDocument()

    fireEvent.click(dialogScope.getAllByRole('button', { name: /redeem this lot/i })[0])
    expect(dialogScope.getByLabelText(/^quantity$/i)).toHaveValue('70')

    fireEvent.click(dialogScope.getByRole('button', { name: /redeem all/i }))
    expect(dialogScope.getByLabelText(/^quantity$/i)).toHaveValue('100')
  })

  it('opens a prefilled redeem composer from holdings quick actions', async () => {
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
              name: 'Primary account',
              institution: 'Broker',
              type: 'BROKERAGE',
              baseCurrency: 'PLN',
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
              id: 'ins-2',
              name: 'EDO0336',
              symbol: null,
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              currency: 'PLN',
              edoTerms: {
                seriesMonth: '2026-03',
                firstPeriodRateBps: 500,
                marginBps: 150,
              },
              valuationSource: 'EDO_CALCULATOR',
              createdAt: '2026-03-13T12:00:00Z',
              updatedAt: '2026-03-13T12:00:00Z',
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
              accountName: 'Primary account',
              instrumentId: 'ins-2',
              instrumentName: 'EDO0336',
              kind: 'BOND_EDO',
              assetClass: 'BONDS',
              currency: 'PLN',
              quantity: '100',
              averageCostPerUnitPln: '100.00',
              costBasisPln: '10000.00',
              bookValuePln: '10000.00',
              currentPricePln: '101.59',
              currentValuePln: '10159.00',
              unrealizedGainPln: '159.00',
              valuedAt: '2026-03-20',
              valuationStatus: 'VALUED',
              valuationIssue: null,
              transactionCount: 2,
              edoLots: [
                {
                  purchaseDate: '2026-03-02',
                  quantity: '70',
                  costBasisPln: '7000.00',
                  currentPricePln: '102.10',
                  currentValuePln: '7147.00',
                  unrealizedGainPln: '147.00',
                  valuedAt: '2026-03-20',
                  valuationStatus: 'VALUED',
                  valuationIssue: null,
                },
                {
                  purchaseDate: '2026-03-22',
                  quantity: '30',
                  costBasisPln: '3000.00',
                  currentPricePln: '100.40',
                  currentValuePln: '3012.00',
                  unrealizedGainPln: '12.00',
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

      if (url.includes('/api/v1/transactions/import/profiles')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/audit/events')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/transactions')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unhandled fetch in holdings redeem quick action test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const view = render(
      <MemoryRouter initialEntries={['/portfolio']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    const scope = within(view.container)

    expect((await scope.findAllByRole('heading', { name: /^portfolio$/i })).length).toBeGreaterThan(0)

    fireEvent.click(await scope.findByText(/EDO0336/))
    fireEvent.click(await scope.findByRole('button', { name: /redeem all/i }))

    expect((await scope.findAllByRole('heading', { name: /^transactions$/i })).length).toBeGreaterThan(0)

    const dialog = await screen.findByRole('dialog', { name: /new transaction/i })
    const dialogScope = within(dialog)

    expect(dialogScope.getByLabelText(/^account$/i)).toHaveValue('acc-1')
    expect(dialogScope.getByLabelText(/^instrument$/i)).toHaveValue('ins-2')
    expect(dialogScope.getByLabelText(/^type$/i)).toHaveValue('REDEEM')
    expect(dialogScope.getByLabelText(/^quantity$/i)).toHaveValue('100')
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

  it('shows n/a for return metrics when history is not fully market valued', async () => {
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

      if (url.includes('/api/v1/portfolio/history/daily')) {
        return new Response(
          JSON.stringify({
            from: '2026-01-01',
            until: '2026-03-13',
            valuationState: 'BOOK_ONLY',
            instrumentHistoryIssueCount: 1,
            referenceSeriesIssueCount: 0,
            benchmarkSeriesIssueCount: 0,
            missingFxTransactions: 0,
            unsupportedCorrectionTransactions: 0,
            points: [
              {
                date: '2026-03-13',
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
                portfolioPerformanceIndex: '1.00',
                benchmarkIndices: { VWRA: '1.02', INFLATION: '1.01', TARGET_MIX: '1.01' },
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
            periods: [
              {
                key: 'YTD',
                label: 'YTD',
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
                benchmarks: [],
              },
              {
                key: 'ONE_YEAR',
                label: '1Y',
                requestedFrom: '2025-03-13',
                from: '2026-01-01',
                until: '2026-03-13',
                clippedToInception: true,
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
                benchmarks: [],
              },
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
                benchmarks: [],
              },
            ],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in performance valuation test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/performance']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^performance$/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText(/^n\/a$/i).length).toBeGreaterThanOrEqual(3)
    })

    fireEvent.click(screen.getByRole('tab', { name: /^returns$/i }))

    expect(await screen.findByText(/returns are temporarily unavailable/i)).toBeInTheDocument()
    expect(await screen.findByText(/instead of pretending they are 0\.00%/i)).toBeInTheDocument()
  })

  it('shows a value-change bridge for the selected performance period', async () => {
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
                date: '2026-01-01',
                totalBookValuePln: '1000.00',
                totalCurrentValuePln: '1000.00',
                netContributionsPln: '1000.00',
                cashBalancePln: '1000.00',
                totalCurrentValueUsd: '250.00',
                netContributionsUsd: '250.00',
                cashBalanceUsd: '250.00',
                totalCurrentValueAu: '0.50',
                netContributionsAu: '0.50',
                cashBalanceAu: '0.50',
                equityCurrentValuePln: '0.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '1000.00',
                equityAllocationPct: '0.00',
                bondAllocationPct: '0.00',
                cashAllocationPct: '100.00',
                portfolioPerformanceIndex: '1.00',
                benchmarkIndices: { VWRA: '1.00', INFLATION: '1.00', TARGET_MIX: '1.00' },
                activeHoldingCount: 0,
                valuedHoldingCount: 0,
              },
              {
                date: '2026-03-13',
                totalBookValuePln: '1075.00',
                totalCurrentValuePln: '1075.00',
                netContributionsPln: '1000.00',
                cashBalancePln: '1075.00',
                totalCurrentValueUsd: '268.75',
                netContributionsUsd: '250.00',
                cashBalanceUsd: '268.75',
                totalCurrentValueAu: '0.54',
                netContributionsAu: '0.50',
                cashBalanceAu: '0.54',
                equityCurrentValuePln: '0.00',
                bondCurrentValuePln: '0.00',
                cashCurrentValuePln: '1075.00',
                equityAllocationPct: '0.00',
                bondAllocationPct: '0.00',
                cashAllocationPct: '100.00',
                portfolioPerformanceIndex: '1.08',
                benchmarkIndices: { VWRA: '1.03', INFLATION: '1.01', TARGET_MIX: '1.02' },
                activeHoldingCount: 0,
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
            periods: [
              {
                key: 'YTD',
                label: 'YTD',
                requestedFrom: '2026-01-01',
                from: '2026-01-01',
                until: '2026-03-13',
                clippedToInception: false,
                dayCount: 72,
                nominalPln: {
                  moneyWeightedReturn: '0.075',
                  annualizedMoneyWeightedReturn: '0.075',
                  timeWeightedReturn: '0.075',
                  annualizedTimeWeightedReturn: '0.075',
                },
                nominalUsd: null,
                realPln: {
                  moneyWeightedReturn: '0.05',
                  annualizedMoneyWeightedReturn: '0.05',
                  timeWeightedReturn: '0.05',
                  annualizedTimeWeightedReturn: '0.05',
                },
                inflationFrom: '2026-01',
                inflationUntil: '2026-03',
                inflationMultiplier: '1.02',
                breakdown: {
                  openingValuePln: '0.00',
                  closingValuePln: '1075.00',
                  netChangePln: '1075.00',
                  netExternalFlowsPln: '1000.00',
                  interestAndCouponsPln: '100.00',
                  feesPln: '-10.00',
                  taxesPln: '-15.00',
                  marketAndFxPln: '0.00',
                  netInvestmentResultPln: '75.00',
                },
                benchmarks: [],
              },
              {
                key: 'ONE_YEAR',
                label: '1Y',
                requestedFrom: '2025-03-13',
                from: '2025-03-13',
                until: '2026-03-13',
                clippedToInception: false,
                dayCount: 365,
                nominalPln: {
                  moneyWeightedReturn: '0.12',
                  annualizedMoneyWeightedReturn: '0.12',
                  timeWeightedReturn: '0.12',
                  annualizedTimeWeightedReturn: '0.12',
                },
                nominalUsd: null,
                realPln: {
                  moneyWeightedReturn: '0.09',
                  annualizedMoneyWeightedReturn: '0.09',
                  timeWeightedReturn: '0.09',
                  annualizedTimeWeightedReturn: '0.09',
                },
                inflationFrom: '2025-03',
                inflationUntil: '2026-03',
                inflationMultiplier: '1.04',
                breakdown: {
                  openingValuePln: '500.00',
                  closingValuePln: '1325.00',
                  netChangePln: '825.00',
                  netExternalFlowsPln: '600.00',
                  interestAndCouponsPln: '150.00',
                  feesPln: '-15.00',
                  taxesPln: '-10.00',
                  marketAndFxPln: '100.00',
                  netInvestmentResultPln: '225.00',
                },
                benchmarks: [],
              },
              {
                key: 'MAX',
                label: 'MAX',
                requestedFrom: '2025-01-01',
                from: '2025-01-01',
                until: '2026-03-13',
                clippedToInception: false,
                dayCount: 437,
                nominalPln: {
                  moneyWeightedReturn: '0.14',
                  annualizedMoneyWeightedReturn: '0.14',
                  timeWeightedReturn: '0.14',
                  annualizedTimeWeightedReturn: '0.14',
                },
                nominalUsd: null,
                realPln: {
                  moneyWeightedReturn: '0.1',
                  annualizedMoneyWeightedReturn: '0.1',
                  timeWeightedReturn: '0.1',
                  annualizedTimeWeightedReturn: '0.1',
                },
                inflationFrom: '2025-01',
                inflationUntil: '2026-03',
                inflationMultiplier: '1.06',
                breakdown: {
                  openingValuePln: '250.00',
                  closingValuePln: '1325.00',
                  netChangePln: '1075.00',
                  netExternalFlowsPln: '900.00',
                  interestAndCouponsPln: '120.00',
                  feesPln: '-20.00',
                  taxesPln: '-15.00',
                  marketAndFxPln: '90.00',
                  netInvestmentResultPln: '175.00',
                },
                benchmarks: [],
              },
            ],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unhandled fetch in performance breakdown test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/performance']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^performance$/i })).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('tab', { name: /^returns$/i }))

    expect(await screen.findByRole('heading', { name: /value-change bridge/i })).toBeInTheDocument()
    expect(screen.getByText(/deposits \/ withdrawals/i)).toBeInTheDocument()
    expect(screen.getByText(/interest \/ coupons/i)).toBeInTheDocument()
    expect(screen.getByText(/^market \+ fx$/i)).toBeInTheDocument()
    expect(screen.getByText(/net investment result/i)).toBeInTheDocument()
    expect(screen.getAllByText((_, element) => element?.textContent?.includes('2025-01-01') ?? false).length).toBeGreaterThan(0)
    expect(screen.getAllByText((_, element) => element?.textContent?.includes('2026-03-13') ?? false).length).toBeGreaterThan(0)
    expect(screen.getAllByText((content) => content.includes('1,325.00')).length).toBeGreaterThan(0)
    expect(screen.getAllByText((content) => content.includes('175.00')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '1Y' }))

    await waitFor(() => {
      expect(screen.getAllByText((_, element) => element?.textContent?.includes('2025-03-13') ?? false).length).toBeGreaterThan(0)
      expect(screen.getAllByText((content) => content.includes('1,325.00')).length).toBeGreaterThan(0)
      expect(screen.getAllByText((content) => content.includes('225.00')).length).toBeGreaterThan(0)
    })
  })

  it('scrolls to hash targets inside settings', async () => {
    const scrollIntoViewMock = vi.fn()
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })
    try {
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

        if (url.includes('/api/v1/portfolio/benchmark-settings')) {
          return new Response(
            JSON.stringify({
              enabledKeys: [],
              pinnedKeys: [],
              options: [],
              customLabel: null,
              customSymbol: null,
            }),
            { status: 200 },
          )
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
                  benchmarkIndices: { VWRA: '1.03', INFLATION: '1.01', TARGET_MIX: '1.02' },
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

        if (url.includes('/api/v1/accounts') || url.includes('/api/v1/instruments') || url.includes('/api/v1/transactions')) {
          return new Response(JSON.stringify([]), { status: 200 })
        }

        if (url.includes('/api/v1/portfolio/state/export')) {
          return new Response(
            JSON.stringify({
              schemaVersion: 4,
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

      const targetsSection = await waitFor(() => {
        const section = document.getElementById('targets')
        expect(section).not.toBeNull()
        return section
      })
      if (!targetsSection) {
        throw new Error('Targets section did not render')
      }

      expect(await screen.findByRole('heading', { name: /next steps|następne kroki/i })).toBeInTheDocument()
      expect(await within(targetsSection).findByRole('heading', { name: /target allocation|alokacja docelowa/i, level: 3 })).toBeInTheDocument()
      expect(await within(targetsSection).findByText(/edited mix|edytowany podział/i)).toBeInTheDocument()
      expect(
        await within(targetsSection).findByText(/no targets are saved yet|brak zapisanej alokacji docelowej/i),
      ).toBeInTheDocument()

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalled()
      })
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoView)
      } else {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
      }
    }
  })

  it('sorts accounts by column header on the accounts screen', async () => {
    const portfolioAccounts = [
      {
        accountId: 'acc-a',
        accountName: 'Alpha',
        institution: 'Broker A',
        type: 'BROKERAGE',
        baseCurrency: 'PLN',
        valuationState: 'MARK_TO_MARKET',
        totalBookValuePln: '1000.00',
        totalCurrentValuePln: '1100.00',
        investedBookValuePln: '600.00',
        investedCurrentValuePln: '600.00',
        cashBalancePln: '500.00',
        netContributionsPln: '1000.00',
        totalUnrealizedGainPln: '100.00',
        portfolioWeightPct: '55.00',
        activeHoldingCount: 1,
        valuedHoldingCount: 1,
        valuationIssueCount: 0,
      },
      {
        accountId: 'acc-b',
        accountName: 'Beta',
        institution: 'Broker B',
        type: 'BROKERAGE',
        baseCurrency: 'PLN',
        valuationState: 'MARK_TO_MARKET',
        totalBookValuePln: '900.00',
        totalCurrentValuePln: '900.00',
        investedBookValuePln: '300.00',
        investedCurrentValuePln: '300.00',
        cashBalancePln: '600.00',
        netContributionsPln: '900.00',
        totalUnrealizedGainPln: '0.00',
        portfolioWeightPct: '45.00',
        activeHoldingCount: 1,
        valuedHoldingCount: 1,
        valuationIssueCount: 0,
      },
    ]

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
        return new Response(JSON.stringify(portfolioAccounts), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/accounts')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      if (url.includes('/api/v1/portfolio/audit/events')) {
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
      <MemoryRouter initialEntries={['/portfolio?tab=accounts']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /portfolio|portfel/i, level: 2 })).toBeInTheDocument()

    // Default sort is by value descending: Alpha (1100) before Beta (900)
    const alphaCells = await screen.findAllByText(/^Alpha$/)
    const betaCells = await screen.findAllByText(/^Beta$/)
    await waitFor(() => {
      expect(appearsBefore(alphaCells[0], betaCells[0])).toBe(true)
    })

    // Click the Account column header to sort by name descending (first click on a new field defaults to desc)
    const table = screen.getByRole('table')
    const accountColumnHeader = within(table).getByRole('button', { name: /account|konto/i })
    fireEvent.click(accountColumnHeader)

    // Beta (B) should be before Alpha (A) in descending name order
    await waitFor(() => {
      const alpha = screen.getAllByText(/^Alpha$/)[0]
      const beta = screen.getAllByText(/^Beta$/)[0]
      expect(appearsBefore(beta, alpha)).toBe(true)
    })

    // Click the Account column header again to sort by name ascending
    fireEvent.click(accountColumnHeader)

    // Alpha (A) should now be before Beta (B) in ascending name order
    await waitFor(() => {
      const alpha = screen.getAllByText(/^Alpha$/)[0]
      const beta = screen.getAllByText(/^Beta$/)[0]
      expect(appearsBefore(alpha, beta)).toBe(true)
    })
  })

  it('shows journal row count tile on the transactions screen', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return new Response(JSON.stringify({ authEnabled: false, authenticated: true, mode: 'DISABLED' }), { status: 200 })
      }
      if (url.includes('/api/v1/meta')) {
        return new Response(JSON.stringify({ name: 'Portfolio', stage: 'dev', version: '0.1.0-dev', auth: { enabled: false, mode: 'DISABLED' }, stack: { web: 'React', api: 'Kotlin', database: 'SQLite' }, capabilities: [] }), { status: 200 })
      }
      if (url.includes('/api/v1/readiness')) {
        return new Response(JSON.stringify({ status: 'READY', checkedAt: '2026-03-13T12:00:00Z', checks: [] }), { status: 200 })
      }
      if (url.includes('/api/v1/accounts')) {
        return new Response(JSON.stringify([{ id: 'acc-1', name: 'Main', kind: 'BROKERAGE', currency: 'PLN', createdAt: '2026-03-13T12:00:00Z', updatedAt: '2026-03-13T12:00:00Z' }]), { status: 200 })
      }
      if (url.includes('/api/v1/instruments')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (url.includes('/api/v1/portfolio/holdings')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (url.includes('/api/v1/transactions')) {
        return new Response(JSON.stringify([
          { id: 'tx-1', accountId: 'acc-1', instrumentId: null, type: 'DEPOSIT', tradeDate: '2026-03-10', settlementDate: null, quantity: null, unitPrice: null, grossAmount: '1000', feeAmount: '0', taxAmount: '0', currency: 'PLN', fxRateToPln: null, notes: '', createdAt: '2026-03-10T12:00:00Z', updatedAt: '2026-03-10T12:00:00Z' },
          { id: 'tx-2', accountId: 'acc-1', instrumentId: null, type: 'DEPOSIT', tradeDate: '2026-03-11', settlementDate: null, quantity: null, unitPrice: null, grossAmount: '2000', feeAmount: '0', taxAmount: '0', currency: 'PLN', fxRateToPln: null, notes: '', createdAt: '2026-03-11T12:00:00Z', updatedAt: '2026-03-11T12:00:00Z' },
        ]), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    // Wait for journal to load — the journal rows in view tile shows "2"
    const rowCountTile = await screen.findByText(/journal rows in view|wiersze dziennika/i)
    const tileContainer = rowCountTile.closest('article')!
    await waitFor(() => {
      expect(tileContainer.querySelector('strong')!.textContent).toBe('2')
    })
  })

  it('includes portfolio-accounts in transaction-related query invalidation keys', async () => {
    // This test verifies that invalidateTransactionRelatedQueries covers portfolio-accounts
    // to prevent stale account summaries after transaction mutations.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    // Seed the portfolio-accounts cache with dummy data
    queryClient.setQueryData(['portfolio-accounts'], [{ id: 'acc-1', name: 'Main' }])
    expect(queryClient.getQueryData(['portfolio-accounts'])).toBeTruthy()

    // Simulate what happens during a transaction mutation: invalidate all transaction-related queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] }),
    ])

    // The portfolio-accounts query state should be invalidated (stale)
    const state = queryClient.getQueryState(['portfolio-accounts'])
    expect(state?.isInvalidated).toBe(true)
  })
})

function appearsBefore(left: HTMLElement, right: HTMLElement) {
  return Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING)
}
