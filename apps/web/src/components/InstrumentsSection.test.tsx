import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstrumentsSection } from './InstrumentsSection'
import { I18nProvider } from '../lib/i18n'
import {
  useCreateInstrument,
  useInstruments,
  useUpdateInstrument,
} from '../hooks/use-write-model'

vi.mock('../hooks/use-write-model', () => ({
  useCreateInstrument: vi.fn(),
  useInstruments: vi.fn(),
  useUpdateInstrument: vi.fn(),
}))

const createMutate = vi.fn()
const updateMutate = vi.fn()

function setPolishLanguage() {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: 'pl-PL',
  })
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: ['pl-PL'],
  })
}

function queryResultStub(data: InstrumentStub[]) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useInstruments>
}

function mutationStub(mutate: ReturnType<typeof vi.fn>) {
  return {
    isPending: false,
    error: null,
    mutate,
  }
}

interface InstrumentStub {
  id: string
  name: string
  kind: string
  assetClass: string
  symbol: string | null
  currency: string
  valuationSource: string
  edoTerms: null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function instrumentStub(overrides: Partial<InstrumentStub> = {}): InstrumentStub {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'VWCE',
    kind: 'ETF',
    assetClass: 'EQUITIES',
    symbol: 'VWCE.DE',
    currency: 'EUR',
    valuationSource: 'STOCK_ANALYST',
    edoTerms: null,
    isActive: true,
    createdAt: '2026-07-17T10:00:00Z',
    updatedAt: '2026-07-17T10:00:00Z',
    ...overrides,
  }
}

function renderSection(instruments: InstrumentStub[] = []) {
  vi.mocked(useInstruments).mockReturnValue(queryResultStub(instruments))
  vi.mocked(useCreateInstrument).mockReturnValue(
    mutationStub(createMutate) as unknown as ReturnType<typeof useCreateInstrument>,
  )
  vi.mocked(useUpdateInstrument).mockReturnValue(
    mutationStub(updateMutate) as unknown as ReturnType<typeof useUpdateInstrument>,
  )

  return render(
    <I18nProvider>
      <InstrumentsSection />
    </I18nProvider>,
  )
}

describe('InstrumentsSection', () => {
  afterEach(cleanup)

  beforeEach(() => {
    setPolishLanguage()
    createMutate.mockReset()
    updateMutate.mockReset()
  })

  it('offers only instrument kinds and valuation sources supported for creation', () => {
    renderSection()

    const kindSelect = screen.getByRole('combobox', { name: 'Rodzaj' })
    const kindValues = within(kindSelect)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)

    expect(kindValues).toEqual(['ETF', 'STOCK', 'BOND_EDO', 'CASH'])
    expect(screen.queryByRole('combobox', { name: 'Źródło wyceny' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Źródło wyceny')).toHaveTextContent('stock-analyst')
    expect(screen.queryByText(/Ręcznie/)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Symbol' })).toBeRequired()
  })

  it('derives the valuation source from the selected kind', async () => {
    const user = userEvent.setup()
    renderSection()

    const kindSelect = screen.getByRole('combobox', { name: 'Rodzaj' })
    await user.selectOptions(kindSelect, 'BOND_EDO')
    expect(screen.getByLabelText('Źródło wyceny')).toHaveTextContent('edo-calculator')

    await user.selectOptions(kindSelect, 'ETF')
    expect(screen.getByLabelText('Źródło wyceny')).toHaveTextContent('stock-analyst')
    expect(screen.getByRole('textbox', { name: 'Nazwa' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Klasa aktywów' })).toHaveValue('EQUITIES')
    expect(screen.getByRole('textbox', { name: 'Waluta' })).toHaveValue('USD')
    expect(screen.getByRole('textbox', { name: 'Symbol' })).toHaveValue('')

    await user.type(screen.getByRole('textbox', { name: 'Nazwa' }), 'VWCE')
    await user.type(screen.getByRole('textbox', { name: 'Symbol' }), 'VWCE.DE')
    await user.click(screen.getByRole('button', { name: 'Dodaj instrument' }))

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'VWCE',
        kind: 'ETF',
        assetClass: 'EQUITIES',
        symbol: 'VWCE.DE',
        currency: 'USD',
        valuationSource: 'STOCK_ANALYST',
        edoTerms: null,
      }),
      expect.any(Object),
    )
  })

  it('keeps a legacy manual source until the user explicitly migrates it', async () => {
    const user = userEvent.setup()
    renderSection([instrumentStub({ valuationSource: 'MANUAL' })])

    await user.click(screen.getByText('VWCE'))

    const sourceSelect = screen.getByRole('combobox', { name: 'Źródło wyceny' })
    expect(sourceSelect).toHaveValue('MANUAL')
    expect(screen.getByText('Ręcznie · nieobsługiwane')).toBeInTheDocument()
    expect(screen.getByText(/historyczne źródło nie jest już obsługiwane/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Symbol' })).not.toBeRequired()

    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    expect(updateMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ valuationSource: 'MANUAL' }),
      expect.any(Object),
    )

    await user.selectOptions(sourceSelect, 'STOCK_ANALYST')
    expect(screen.getByRole('textbox', { name: 'Symbol' })).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    expect(updateMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ valuationSource: 'STOCK_ANALYST' }),
      expect.any(Object),
    )
  })

  it('allows a legacy stock analyst instrument without a symbol to retain that state', async () => {
    const user = userEvent.setup()
    renderSection([instrumentStub({ symbol: null })])

    await user.click(screen.getByText('VWCE'))

    expect(screen.getByRole('textbox', { name: 'Symbol' })).not.toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: null,
        valuationSource: 'STOCK_ANALYST',
      }),
      expect.any(Object),
    )
  })

  it('continues to render and edit a legacy gold benchmark without offering it for creation', async () => {
    const user = userEvent.setup()
    renderSection([
      instrumentStub({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Stary benchmark złota',
        kind: 'BENCHMARK_GOLD',
        assetClass: 'BENCHMARK',
        symbol: null,
        currency: 'PLN',
        valuationSource: 'MANUAL',
      }),
    ])

    await user.click(screen.getByText('Stary benchmark złota'))

    const kindSelect = screen.getByRole('combobox', { name: 'Rodzaj' })
    expect(kindSelect).toBeDisabled()
    expect(kindSelect).toHaveValue('BENCHMARK_GOLD')
    expect(screen.queryByRole('combobox', { name: 'Źródło wyceny' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Źródło wyceny')).toHaveTextContent('Ręcznie · nieobsługiwane')

    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-0000-0000-000000000002',
        valuationSource: 'MANUAL',
      }),
      expect.any(Object),
    )
  })
})
