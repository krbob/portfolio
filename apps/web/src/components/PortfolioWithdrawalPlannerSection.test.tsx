import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { PortfolioWithdrawalPlannerSection } from './PortfolioWithdrawalPlannerSection'

const accounts = [
  {
    id: 'account-brokerage',
    name: 'Konto maklerskie',
    institution: 'Broker',
    type: 'BROKERAGE',
    baseCurrency: 'PLN',
    isActive: true,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'account-ike',
    name: 'Konto IKE',
    institution: 'Broker',
    type: 'BROKERAGE',
    baseCurrency: 'PLN',
    isActive: true,
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-01-02T10:00:00Z',
  },
  {
    id: 'account-closed',
    name: 'Konto zamknięte',
    institution: 'Dawny broker',
    type: 'BROKERAGE',
    baseCurrency: 'PLN',
    isActive: false,
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2026-01-03T10:00:00Z',
  },
]

const initialSettings = {
  accountRules: [
    { accountId: 'account-brokerage', enabled: true, taxWrapper: 'STANDARD', taxBufferRatePct: '19.00' },
    { accountId: 'account-ike', enabled: true, taxWrapper: 'IKE', taxBufferRatePct: '0.00' },
    { accountId: 'account-closed', enabled: true, taxWrapper: 'STANDARD', taxBufferRatePct: '19.00' },
  ],
}

const planResponse = {
  asOf: '2026-07-18',
  valuationState: 'MARK_TO_MARKET',
  requestedAmountPln: '10000.00',
  requestedPortfolioPercentagePct: null,
  requestedWithdrawalPln: '10000.00',
  plannedWithdrawalPln: '10000.00',
  feasible: true,
  shortfallPln: '0.00',
  cashUsedPln: '5000.00',
  grossSalesPln: '6172.84',
  estimatedTaxBufferPln: '1172.84',
  projectedTotalValuePln: '88827.16',
  accountPlans: [
    {
      accountId: 'account-brokerage',
      accountName: 'Konto maklerskie',
      taxWrapper: 'STANDARD',
      taxBufferRatePct: '19.00',
      currentValuePln: '100000.00',
      availableCashPln: '5000.00',
      cashUsedPln: '5000.00',
      grossSalesPln: '6172.84',
      estimatedTaxBufferPln: '1172.84',
      withdrawalPln: '10000.00',
      projectedValuePln: '88827.16',
      sales: [{ assetClass: 'EQUITIES', amountPln: '6172.84' }],
    },
  ],
  buckets: [
    {
      assetClass: 'EQUITIES',
      currentValuePln: '80000.00',
      plannedSalePln: '6172.84',
      projectedValuePln: '73827.16',
      projectedWeightPct: '83.11',
      targetWeightPct: '80.00',
      projectedDriftPctPoints: '3.11',
    },
    {
      assetClass: 'BONDS',
      currentValuePln: '15000.00',
      plannedSalePln: '0.00',
      projectedValuePln: '15000.00',
      projectedWeightPct: '16.89',
      targetWeightPct: '20.00',
      projectedDriftPctPoints: '-3.11',
    },
    {
      assetClass: 'CASH',
      currentValuePln: '0.00',
      plannedSalePln: '0.00',
      projectedValuePln: '0.00',
      projectedWeightPct: '0.00',
      targetWeightPct: null,
      projectedDriftPctPoints: null,
    },
  ],
  warnings: ['STALE_VALUATIONS'],
}

describe('PortfolioWithdrawalPlannerSection', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'pl-PL',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['pl-PL'],
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('calculates only on demand and renders the funding and allocation preview', async () => {
    const planBodies: unknown[] = []
    mockApi({ planBodies })
    const user = userEvent.setup()
    renderSection()

    expect(await screen.findByRole('heading', { name: 'Plan wypłaty' })).toBeInTheDocument()
    expect(screen.getAllByText('Tylko podgląd').length).toBeGreaterThan(0)
    expect(planBodies).toHaveLength(0)

    await user.type(screen.getByLabelText('Kwota wypłaty'), '10000')
    expect(planBodies).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Oblicz plan' }))

    await waitFor(() => expect(planBodies).toEqual([{ amountPln: '10000.00' }]))
    expect(await screen.findByRole('heading', { name: 'Podsumowanie scenariusza' })).toBeInTheDocument()
    expect(screen.getByText('Możliwa do pokrycia')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kolejność finansowania' })).toBeInTheDocument()
    expect(screen.getByText('Krok 1')).toBeInTheDocument()
    expect(screen.getAllByText('Konto maklerskie').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Wpływ na alokację' })).toBeInTheDocument()
    expect(screen.getAllByText(/88.827,16 zł/)).toHaveLength(2)
    expect(screen.getByRole('row', { name: /Akcje/ })).toHaveTextContent('83,11%')
    expect(screen.getByRole('row', { name: /Akcje/ })).toHaveTextContent('+3,11 pp')
    expect(screen.getByRole('row', { name: /Obligacje/ })).toHaveTextContent('16,89%')
    expect(screen.getByRole('row', { name: /Obligacje/ })).toHaveTextContent('-3,11 pp')
    expect(screen.getByRole('row', { name: /Gotówka/ })).toHaveTextContent('0,00%')
    expect(within(screen.getByRole('row', { name: /Gotówka/ })).getAllByText('—')).toHaveLength(2)
    expect(screen.getByText('Część planu opiera się na nieaktualnych wycenach.')).toBeInTheDocument()
  })

  it('sends a percentage instead of an amount after switching modes', async () => {
    const planBodies: unknown[] = []
    mockApi({ planBodies })
    const user = userEvent.setup()
    renderSection()

    await screen.findByRole('heading', { name: 'Plan wypłaty' })
    await user.click(screen.getByRole('button', { name: 'Procent portfela' }))
    await user.type(screen.getByLabelText('Procent wartości portfela'), '4,5')
    await user.click(screen.getByRole('button', { name: 'Oblicz plan' }))

    await waitFor(() => expect(planBodies).toEqual([{ portfolioPercentagePct: '4.50' }]))
  })

  it('reorders accounts and saves explicit classifications and manual buffers', async () => {
    const settingsBodies: unknown[] = []
    mockApi({ settingsBodies })
    const user = userEvent.setup()
    renderSection()

    expect(await screen.findByRole('heading', { name: 'Konta i bufory podatkowe' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Przenieś Konto maklerskie niżej' }))

    const ikeRow = screen.getByText('Konto IKE').closest('article')
    if (!ikeRow) throw new Error('Missing IKE account row')
    await user.selectOptions(within(ikeRow).getByLabelText('Klasyfikacja konta'), 'OKI')
    await user.clear(within(ikeRow).getByLabelText('Ręczny bufor'))
    await user.type(within(ikeRow).getByLabelText('Ręczny bufor'), '3,5')
    await user.click(within(ikeRow).getByLabelText('Uwzględniaj konto'))
    await user.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }))

    await waitFor(() => expect(settingsBodies).toHaveLength(1))
    expect(settingsBodies[0]).toEqual({
      accountRules: [
        { accountId: 'account-ike', enabled: false, taxWrapper: 'OKI', taxBufferRatePct: '3.50' },
        { accountId: 'account-brokerage', enabled: true, taxWrapper: 'STANDARD', taxBufferRatePct: '19.00' },
        { accountId: 'account-closed', enabled: false, taxWrapper: 'STANDARD', taxBufferRatePct: '19.00' },
      ],
    })
    expect(await screen.findByText('Zapisano kolejność kont i bufory.')).toBeInTheDocument()
  })

  it('clears a calculated result while settings are dirty and keeps it empty after saving', async () => {
    const planBodies: unknown[] = []
    const settingsBodies: unknown[] = []
    mockApi({ planBodies, settingsBodies })
    const user = userEvent.setup()
    renderSection()

    await user.type(await screen.findByLabelText('Kwota wypłaty'), '10000')
    await user.click(screen.getByRole('button', { name: 'Oblicz plan' }))
    expect(await screen.findByRole('heading', { name: 'Podsumowanie scenariusza' })).toBeInTheDocument()

    const ikeRow = screen.getByText('Konto IKE').closest('article')
    if (!ikeRow) throw new Error('Missing IKE account row')
    await user.selectOptions(within(ikeRow).getByLabelText('Klasyfikacja konta'), 'OKI')

    expect(screen.queryByRole('heading', { name: 'Podsumowanie scenariusza' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Najpierw zapisz ustawienia' })).toBeInTheDocument()
    expect(screen.getByText(/Poprzedni wynik został wyczyszczony/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oblicz plan' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }))
    await waitFor(() => expect(settingsBodies).toHaveLength(1))
    expect(await screen.findByRole('heading', { name: 'Podaj planowaną wypłatę' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Podsumowanie scenariusza' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oblicz plan' })).toBeEnabled()
    expect(planBodies).toHaveLength(1)
  })

  it('keeps malformed planner literals unchanged and never submits them as another number', async () => {
    const planBodies: unknown[] = []
    mockApi({ planBodies })
    const user = userEvent.setup()
    renderSection()
    const amountInput = await screen.findByLabelText('Kwota wypłaty')

    await user.type(amountInput, '-1000')
    expect(amountInput).toHaveValue('-1000')
    await user.click(screen.getByRole('button', { name: 'Oblicz plan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Podaj kwotę większą od zera.')
    expect(planBodies).toHaveLength(0)

    await user.clear(amountInput)
    await user.type(amountInput, '1e3')
    expect(amountInput).toHaveValue('1e3')
    await user.click(screen.getByRole('button', { name: 'Oblicz plan' }))
    expect(planBodies).toHaveLength(0)

    await user.clear(amountInput)
    await user.type(amountInput, '9007199254740993.25')
    await user.click(screen.getByRole('button', { name: 'Oblicz plan' }))
    await waitFor(() => expect(planBodies).toEqual([{ amountPln: '9007199254740993.25' }]))
  })

  it('forces inactive accounts off and rejects a malformed manual buffer verbatim', async () => {
    const settingsBodies: unknown[] = []
    mockApi({ settingsBodies })
    const user = userEvent.setup()
    renderSection()

    const inactiveRow = (await screen.findByText('Konto zamknięte')).closest('article')
    if (!inactiveRow) throw new Error('Missing inactive account row')
    expect(within(inactiveRow).getByText('Nieaktywne')).toBeInTheDocument()
    expect(within(inactiveRow).getByLabelText('Uwzględniaj konto')).toBeDisabled()
    expect(within(inactiveRow).getByLabelText('Uwzględniaj konto')).not.toBeChecked()

    const brokerageRow = screen.getByText('Konto maklerskie').closest('article')
    if (!brokerageRow) throw new Error('Missing brokerage account row')
    const bufferInput = within(brokerageRow).getByLabelText('Ręczny bufor')
    await user.clear(bufferInput)
    await user.type(bufferInput, '-19')
    expect(bufferInput).toHaveValue('-19')
    await user.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bufor dla każdego konta musi mieścić się')
    expect(settingsBodies).toHaveLength(0)
  })
})

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PortfolioWithdrawalPlannerSection />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function mockApi({
  planBodies = [],
  settingsBodies = [],
}: {
  planBodies?: unknown[]
  settingsBodies?: unknown[]
}) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    const method = input instanceof Request ? input.method : init?.method ?? 'GET'

    if (url.includes('/api/v1/portfolio/allocation/withdrawal-plan') && method === 'POST') {
      planBodies.push(JSON.parse(String(init?.body)))
      return jsonResponse(planResponse)
    }
    if (url.includes('/api/v1/portfolio/withdrawal-settings') && method === 'POST') {
      const body = JSON.parse(String(init?.body))
      settingsBodies.push(body)
      return jsonResponse(body)
    }
    if (url.includes('/api/v1/portfolio/withdrawal-settings')) {
      return jsonResponse(initialSettings)
    }
    if (url.includes('/api/v1/accounts')) {
      return jsonResponse(accounts)
    }
    throw new Error(`Unhandled fetch in withdrawal planner test: ${method} ${url}`)
  })
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
