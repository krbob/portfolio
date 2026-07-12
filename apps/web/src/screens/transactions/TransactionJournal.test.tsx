import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, Instrument, Transaction } from '../../api/write-model'
import { I18nProvider } from '../../lib/i18n'
import { TransactionJournal } from './TransactionJournal'

describe('TransactionJournal sell availability', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-GB' })
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-GB'] })
  })

  it('updates sellable instruments when account and trade date change', async () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <TransactionJournal
            accounts={[account('account-a', 'Primary'), account('account-b', 'Pension')]}
            instruments={[instrument('instrument-a', 'VWCE'), instrument('instrument-b', 'IWDA')]}
            transactions={[
              buy('buy-a', 'account-a', 'instrument-a', '2026-03-01', '10'),
              buy('buy-b', 'account-b', 'instrument-b', '2026-03-03', '5'),
            ]}
            holdingsQuery={queryStub()}
            createTransactionMutation={mutationStub()}
            updateTransactionMutation={mutationStub()}
            deleteTransactionMutation={mutationStub()}
          />
        </I18nProvider>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /new transaction/i }))
    const dialog = await screen.findByRole('dialog', { name: /new transaction/i })
    const scope = within(dialog)
    const accountSelect = scope.getByLabelText(/^account$/i)
    const typeSelect = scope.getByLabelText(/^type$/i)
    const tradeDateInput = scope.getByLabelText(/^trade date$/i)

    fireEvent.change(typeSelect, { target: { value: 'SELL' } })
    fireEvent.change(accountSelect, { target: { value: 'account-a' } })
    fireEvent.change(tradeDateInput, { target: { value: '2026-03-02' } })

    let instrumentSelect = scope.getByLabelText(/^instrument$/i) as HTMLSelectElement
    expect(optionLabels(instrumentSelect)).toEqual(['Select instrument', 'VWCE · 10 available'])

    fireEvent.change(instrumentSelect, { target: { value: 'instrument-a' } })
    fireEvent.change(tradeDateInput, { target: { value: '2026-02-28' } })
    await waitFor(() => expect(scope.getByLabelText(/^instrument$/i)).toHaveValue(''))
    expect(optionLabels(scope.getByLabelText(/^instrument$/i) as HTMLSelectElement)).toEqual(['Select instrument'])

    fireEvent.change(accountSelect, { target: { value: 'account-b' } })
    fireEvent.change(tradeDateInput, { target: { value: '2026-03-04' } })
    instrumentSelect = scope.getByLabelText(/^instrument$/i) as HTMLSelectElement
    expect(optionLabels(instrumentSelect)).toEqual(['Select instrument', 'IWDA · 5 available'])
  })
})

function account(id: string, name: string): Account {
  return {
    id,
    name,
    institution: 'Broker',
    type: 'BROKERAGE',
    baseCurrency: 'PLN',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function instrument(id: string, name: string): Instrument {
  return {
    id,
    name,
    kind: 'ETF',
    assetClass: 'EQUITIES',
    symbol: `${name}.DE`,
    currency: 'EUR',
    valuationSource: 'STOCK_ANALYST',
    edoTerms: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function buy(
  id: string,
  accountId: string,
  instrumentId: string,
  tradeDate: string,
  quantity: string,
): Transaction {
  return {
    id,
    accountId,
    instrumentId,
    type: 'BUY',
    tradeDate,
    settlementDate: tradeDate,
    quantity,
    unitPrice: '100',
    grossAmount: '100',
    feeAmount: '0',
    taxAmount: '0',
    currency: 'PLN',
    fxRateToPln: null,
    notes: '',
    createdAt: `${tradeDate}T12:00:00Z`,
    updatedAt: `${tradeDate}T12:00:00Z`,
  }
}

function optionLabels(select: HTMLSelectElement): Array<string | null> {
  return Array.from(select.options).map((option) => option.textContent)
}

function queryStub() {
  return {
    data: [],
    isLoading: false,
    error: null,
  } as never
}

function mutationStub() {
  return {
    isPending: false,
    error: null,
    mutate: vi.fn(),
  } as never
}
