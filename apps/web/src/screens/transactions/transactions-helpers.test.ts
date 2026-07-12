import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../api/write-model'
import {
  buildInstrumentAvailabilityAsOf,
  formatTransactionSubmitError,
  quantityExceedsAvailability,
} from './transactions-helpers'

describe('transaction disposal availability', () => {
  it('replays only the selected account through the selected trade date', () => {
    const transactions = [
      transaction({ id: 'buy-a', accountId: 'account-a', instrumentId: 'instrument-a', type: 'BUY', tradeDate: '2026-03-01', quantity: '10' }),
      transaction({ id: 'sell-a', accountId: 'account-a', instrumentId: 'instrument-a', type: 'SELL', tradeDate: '2026-03-02', quantity: '4' }),
      transaction({ id: 'future-buy', accountId: 'account-a', instrumentId: 'instrument-a', type: 'BUY', tradeDate: '2026-03-04', quantity: '5' }),
      transaction({ id: 'other-account', accountId: 'account-b', instrumentId: 'instrument-a', type: 'BUY', tradeDate: '2026-03-01', quantity: '99' }),
      transaction({ id: 'fractional-buy', accountId: 'account-a', instrumentId: 'instrument-b', type: 'BUY', tradeDate: '2026-03-01', quantity: '3.5' }),
      transaction({ id: 'fractional-sell', accountId: 'account-a', instrumentId: 'instrument-b', type: 'SELL', tradeDate: '2026-03-02', quantity: '1.2' }),
    ]

    const availability = buildInstrumentAvailabilityAsOf(
      transactions,
      'account-a',
      '2026-03-02',
    )

    expect(Object.fromEntries(availability)).toEqual({
      'instrument-a': '6',
      'instrument-b': '2.3',
    })
  })

  it('excludes the edited transaction before calculating availability', () => {
    const transactions = [
      transaction({ id: 'buy', type: 'BUY', quantity: '10' }),
      transaction({ id: 'edited-sell', type: 'SELL', quantity: '6' }),
    ]

    expect(buildInstrumentAvailabilityAsOf(transactions, 'account-a', '2026-03-02').get('instrument-a')).toBe('4')
    expect(
      buildInstrumentAvailabilityAsOf(
        transactions,
        'account-a',
        '2026-03-02',
        'edited-sell',
      ).get('instrument-a'),
    ).toBe('10')
  })

  it('compares requested and available quantities without floating point rounding', () => {
    expect(quantityExceedsAvailability('2.3', '2.30')).toBe(false)
    expect(quantityExceedsAvailability('2.300000000000000001', '2.3')).toBe(true)
    expect(quantityExceedsAvailability('', '2.3')).toBe(false)
    expect(quantityExceedsAvailability('1', null)).toBe(false)
  })

  it('adds recovery guidance to long-only errors returned by the server', () => {
    const serverMessage =
      'SELL transaction exceeds the available quantity. Long-only portfolios cannot have negative instrument positions.'

    const message = formatTransactionSubmitError(serverMessage)

    expect(message).toContain(serverMessage)
    expect(message).not.toBe(serverMessage)
  })
})

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'transaction-id',
    accountId: 'account-a',
    instrumentId: 'instrument-a',
    type: 'BUY',
    tradeDate: '2026-03-02',
    settlementDate: '2026-03-02',
    quantity: '1',
    unitPrice: '100',
    grossAmount: '100',
    feeAmount: '0',
    taxAmount: '0',
    currency: 'PLN',
    fxRateToPln: null,
    notes: '',
    createdAt: '2026-03-02T12:00:00Z',
    updatedAt: '2026-03-02T12:00:00Z',
    ...overrides,
  }
}
