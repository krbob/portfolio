import { describe, expect, it } from 'vitest'
import type { PortfolioOverview } from '../api/read-model'
import {
  calculateGainPct,
  describeHoldingGainValue,
  describePortfolioGain,
  describePortfolioValuationBasis,
  formatHoldingGainPreview,
  formatHoldingQuantity,
  labelPortfolioValuationState,
} from './portfolio-presentation'

describe('portfolio-presentation', () => {
  it('calculates gain rate only when the book value is positive', () => {
    expect(calculateGainPct('110.00', '100.00')).toBeCloseTo(10)
    expect(calculateGainPct('110.00', '0.00')).toBeNull()
  })

  it('formats holding quantities without forcing four decimal places', () => {
    expect(formatHoldingQuantity('12')).toBe('12')
    expect(formatHoldingQuantity('12.3456')).toBe('12.35')
  })

  it('uses explicit fallback labels when gain preview is unavailable', () => {
    expect(formatHoldingGainPreview(null, true)).toBe('b/d')
    expect(formatHoldingGainPreview(null, false)).toBe('N/A')
  })

  it('describes partially valued holdings in the gain summary', () => {
    expect(describePortfolioGain(7, 4, true)).toBe('4/7 pozycji z wyceną rynkową')
    expect(describePortfolioGain(7, 4, false, { cashExcluded: true })).toBe(
      '4/7 holdings with market valuation · cash excluded',
    )
  })

  it('describes valuation basis for stale pricing separately from book-only mode', () => {
    const staleOverview = {
      valuationState: 'STALE',
      activeHoldingCount: 7,
      valuedHoldingCount: 5,
    } as PortfolioOverview
    const bookOnlyOverview = {
      valuationState: 'BOOK_ONLY',
      activeHoldingCount: 3,
      valuedHoldingCount: 0,
    } as PortfolioOverview

    expect(describePortfolioValuationBasis(staleOverview, true)).toBe(
      '5 z 7 pozycji ma ostatnią dostępną wycenę rynkową',
    )
    expect(describePortfolioValuationBasis(bookOnlyOverview, false)).toBe(
      '0 of 3 holdings have market valuations',
    )
  })

  it('keeps holding gain copy explicit when no market valuation is available', () => {
    expect(describeHoldingGainValue(2, 0, null, true)).toBe('Brak wyceny rynkowej pozycji')
    expect(describeHoldingGainValue(2, 2, '15.25', false)).toMatch(/15\.25/)
  })

  it('maps valuation states to concise polish labels', () => {
    expect(labelPortfolioValuationState('MARK_TO_MARKET', true)).toBe('Rynkowa')
    expect(labelPortfolioValuationState('STALE', true)).toBe('Opóźniona')
    expect(labelPortfolioValuationState('PARTIALLY_VALUED', true)).toBe('Niepełna')
    expect(labelPortfolioValuationState('BOOK_ONLY', true)).toBe('Księgowa')
  })
})
