import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCurrency,
  formatCurrencyBreakdown,
  formatCurrencyPln,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatSignedCurrencyPln,
  formatYearMonth,
  hasMeaningfulCurrencyBreakdown,
} from './format'

describe('formatCurrencyPln', () => {
  it('formats a positive numeric string', () => {
    const result = formatCurrencyPln('1234.56')
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
  })

  it('formats a number value', () => {
    const result = formatCurrencyPln(0)
    expect(result).toContain('0')
  })

  it('returns unavailable label for null', () => {
    expect(formatCurrencyPln(null)).toMatch(/niedostępne|unavailable/i)
  })

  it('returns unavailable label for empty string', () => {
    expect(formatCurrencyPln('')).toMatch(/niedostępne|unavailable/i)
  })

  it('returns unavailable label for NaN string', () => {
    expect(formatCurrencyPln('abc')).toMatch(/niedostępne|unavailable/i)
  })
})

describe('formatCurrency', () => {
  it('formats with USD currency', () => {
    const result = formatCurrency('99.99', 'USD')
    expect(result).toContain('99')
  })

  it('returns unavailable when currency is null', () => {
    expect(formatCurrency('100', null)).toMatch(/niedostępne|unavailable/i)
  })

  it('returns unavailable when value is null', () => {
    expect(formatCurrency(null, 'PLN')).toMatch(/niedostępne|unavailable/i)
  })
})

describe('formatCurrencyBreakdown', () => {
  it('returns undefined for empty array', () => {
    expect(formatCurrencyBreakdown([])).toBeUndefined()
  })

  it('returns undefined for null', () => {
    expect(formatCurrencyBreakdown(null)).toBeUndefined()
  })

  it('joins multiple currency amounts', () => {
    const result = formatCurrencyBreakdown([
      { currency: 'PLN', amount: '100' },
      { currency: 'USD', amount: '50' },
    ])
    expect(result).toContain('·')
  })

  it('filters out unavailable amounts', () => {
    const result = formatCurrencyBreakdown([
      { currency: 'PLN', amount: '100' },
      { currency: 'USD', amount: null },
    ])
    expect(result).toBeDefined()
    expect(result).not.toContain('·')
  })
})

describe('hasMeaningfulCurrencyBreakdown', () => {
  it('returns false for empty', () => {
    expect(hasMeaningfulCurrencyBreakdown([])).toBe(false)
    expect(hasMeaningfulCurrencyBreakdown(null)).toBe(false)
  })

  it('returns false for single PLN item', () => {
    expect(hasMeaningfulCurrencyBreakdown([{ currency: 'PLN', amount: '100' }])).toBe(false)
  })

  it('returns true for non-PLN currency', () => {
    expect(hasMeaningfulCurrencyBreakdown([{ currency: 'USD', amount: '50' }])).toBe(true)
  })

  it('returns true for multiple items', () => {
    expect(
      hasMeaningfulCurrencyBreakdown([
        { currency: 'PLN', amount: '100' },
        { currency: 'USD', amount: '50' },
      ]),
    ).toBe(true)
  })
})

describe('formatSignedCurrencyPln', () => {
  it('prepends + for positive values', () => {
    const result = formatSignedCurrencyPln('100')
    expect(result).toMatch(/^\+/)
  })

  it('shows minus for negative values', () => {
    const result = formatSignedCurrencyPln('-50')
    expect(result).toContain('50')
  })

  it('shows no sign for zero', () => {
    const result = formatSignedCurrencyPln('0')
    expect(result).not.toMatch(/^[+-]/)
  })

  it('returns unavailable for null', () => {
    expect(formatSignedCurrencyPln(null)).toMatch(/niedostępne|unavailable/i)
  })
})

describe('formatNumber', () => {
  it('formats a plain number', () => {
    const result = formatNumber(1234.5)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })

  it('respects maximumFractionDigits', () => {
    const result = formatNumber('3.14159', { maximumFractionDigits: 4 })
    expect(result).toContain('3')
    expect(result).toContain('1416')
  })

  it('returns unavailable for null', () => {
    expect(formatNumber(null)).toMatch(/niedostępne|unavailable/i)
  })
})

describe('formatPercent', () => {
  it('formats a basic percent', () => {
    const result = formatPercent(12.34)
    expect(result).toMatch(/12[.,]34%/)
  })

  it('applies signed formatting', () => {
    expect(formatPercent(5, { signed: true })).toMatch(/^\+5/)
    expect(formatPercent(-3, { signed: true })).toMatch(/^-3/)
    expect(formatPercent(0, { signed: true })).toMatch(/^0/)
  })

  it('applies scale factor', () => {
    const result = formatPercent(0.1234, { scale: 100 })
    expect(result).toMatch(/12[.,]34%/)
  })

  it('respects custom suffix', () => {
    const result = formatPercent(5, { suffix: ' pp' })
    expect(result).toMatch(/5[.,]00 pp/)
  })

  it('returns unavailable for null', () => {
    expect(formatPercent(null)).toMatch(/niedostępne|unavailable/i)
  })
})

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-03-15')
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })

  it('returns n/a for null', () => {
    expect(formatDate(null)).toMatch(/n\/[da]/i)
  })

  it('returns n/a for empty string', () => {
    expect(formatDate('')).toMatch(/n\/[da]/i)
  })

  it('returns n/a for invalid date string', () => {
    expect(formatDate('not-a-date')).toMatch(/n\/[da]/i)
  })
})

describe('formatDateTime', () => {
  it('formats a valid ISO datetime', () => {
    const result = formatDateTime('2024-03-15T10:30:00Z')
    expect(result).toContain('2024')
  })

  it('returns n/a for null', () => {
    expect(formatDateTime(null)).toMatch(/n\/[da]/i)
  })
})

describe('formatYearMonth', () => {
  it('formats a valid year-month string', () => {
    const result = formatYearMonth('2024-03')
    expect(result).toContain('2024')
  })

  it('returns n/a for null', () => {
    expect(formatYearMonth(null)).toMatch(/n\/[da]/i)
  })

  it('returns n/a for invalid format', () => {
    expect(formatYearMonth('2024/03')).toMatch(/n\/[da]/i)
    expect(formatYearMonth('2024-13')).toMatch(/n\/[da]/i)
    expect(formatYearMonth('2024-00')).toMatch(/n\/[da]/i)
  })

  it('handles edge months', () => {
    expect(formatYearMonth('2024-01')).toContain('2024')
    expect(formatYearMonth('2024-12')).toContain('2024')
  })
})

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB')
  })
})
