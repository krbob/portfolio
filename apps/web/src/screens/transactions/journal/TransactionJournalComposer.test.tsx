import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../lib/i18n'
import { createInitialTransactionForm } from '../transactions-helpers'
import { TransactionJournalComposer } from './TransactionJournalComposer'

describe('TransactionJournalComposer disposal guards', () => {
  beforeEach(() => {
    cleanup()
    document.body.replaceChildren()
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-GB' })
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-GB'] })
  })

  it('shows sell availability and disables submit for an oversell', async () => {
    const initialForm = createInitialTransactionForm()
    renderComposer({
      form: {
        ...initialForm,
        accountId: 'account-a',
        instrumentId: 'instrument-a',
        type: 'SELL',
        tradeDate: '2026-03-02',
        settlementDate: '2026-03-02',
        quantity: '11',
        unitPrice: '100',
        grossAmount: '1100',
      },
      sellAvailabilityByInstrumentId: new Map([['instrument-a', '10']]),
      selectedSellAvailableQuantity: '10',
      sellQuantityExceedsAvailable: true,
    })

    const availabilityWarning = await screen.findByText(/available at the end of/i)
    expect(availabilityWarning).toHaveTextContent(/10 units/i)
    expect(availabilityWarning).toHaveTextContent(/quantity exceeds the position available/i)
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeDisabled()
  })

  it('turns the existing redeem shortfall warning into a submit blocker', async () => {
    const initialForm = createInitialTransactionForm()
    renderComposer({
      form: {
        ...initialForm,
        accountId: 'account-a',
        instrumentId: 'edo-a',
        type: 'REDEEM',
        tradeDate: '2026-03-02',
        settlementDate: '2026-03-02',
        quantity: '11',
        unitPrice: '100',
        grossAmount: '1100',
      },
      selectableInstrumentOptions: [edoInstrument],
      selectedRedeemLots: [
        {
          purchaseDate: '2025-01-01',
          quantity: '10',
          costBasisPln: '1000',
          currentValuePln: '1100',
          unrealizedGainPln: '100',
          valuationIssue: null,
        },
      ],
      redeemPreview: {
        requestedQuantity: 11,
        totalAvailableQuantity: 10,
        unmatchedQuantity: 1,
        byPurchaseDate: new Map([
          ['2025-01-01', { consumedQuantity: 10, remainingQuantity: 0 }],
        ]),
      },
      redeemableEdoHoldingsCount: 1,
      hasSelectedRedeemHolding: true,
    })

    expect(await screen.findByText(/exceeds available lots by 1 units/i)).toHaveAttribute('role', 'alert')
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeDisabled()
  })
})

const account = {
  id: 'account-a',
  name: 'Primary',
  institution: 'Broker',
  type: 'BROKERAGE',
  baseCurrency: 'PLN',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const instrument = {
  id: 'instrument-a',
  name: 'VWCE',
  kind: 'ETF',
  assetClass: 'EQUITIES',
  symbol: 'VWCE.DE',
  currency: 'EUR',
  valuationSource: 'STOCK_ANALYST',
  edoTerms: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const edoInstrument = {
  ...instrument,
  id: 'edo-a',
  name: 'EDO0135',
  kind: 'BOND_EDO',
  assetClass: 'BONDS',
  symbol: null,
  currency: 'PLN',
  valuationSource: 'EDO_CALCULATOR',
  edoTerms: {
    seriesMonth: '2025-01',
    firstPeriodRateBps: 650,
    marginBps: 200,
  },
}

type ComposerProps = ComponentProps<typeof TransactionJournalComposer>

function renderComposer(overrides: Partial<ComposerProps> = {}) {
  const initialForm = createInitialTransactionForm()
  const props: ComposerProps = {
    open: true,
    editingTransactionId: null,
    form: initialForm,
    sortedAccountOptions: [account],
    selectableInstrumentOptions: [instrument],
    sellAvailabilityByInstrumentId: new Map<string, string>(),
    selectedSellAvailableQuantity: null,
    sellQuantityExceedsAvailable: false,
    requiresInstrument: true,
    decimalSeparator: '.' as const,
    grossAmountMode: 'manual' as const,
    showSettlementDateField: false,
    selectedRedeemLots: [],
    redeemPreview: {
      requestedQuantity: 0,
      totalAvailableQuantity: 0,
      unmatchedQuantity: 0,
      byPurchaseDate: new Map(),
    },
    isHoldingsLoading: false,
    holdingsErrorMessage: null,
    redeemableEdoHoldingsCount: 0,
    hasSelectedRedeemHolding: false,
    createPending: false,
    updatePending: false,
    submitErrorMessage: null,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onAccountChange: vi.fn(),
    onTypeChange: vi.fn(),
    onTradeDateChange: vi.fn(),
    onInstrumentChange: vi.fn(),
    onQuantityChange: vi.fn(),
    onUnitPriceChange: vi.fn(),
    onGrossAmountChange: vi.fn(),
    onApplySuggestedGrossAmount: vi.fn(),
    onFeeAmountChange: vi.fn(),
    onTaxAmountChange: vi.fn(),
    onCurrencyChange: vi.fn(),
    onFxRateChange: vi.fn(),
    onNotesChange: vi.fn(),
    onOpenSettlementDateField: vi.fn(),
    onResetSettlementDateToTradeDate: vi.fn(),
    onSettlementDateChange: vi.fn(),
    ...overrides,
  }

  return render(
    <I18nProvider>
      <TransactionJournalComposer {...props} />
    </I18nProvider>,
  )
}
