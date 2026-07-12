import { describe, expect, it } from 'vitest'
import { buildStockAnalystAnalysisUrl } from './stock-analyst'

describe('buildStockAnalystAnalysisUrl', () => {
  it('appends the symbol as a query parameter to the public analysis URL', () => {
    expect(buildStockAnalystAnalysisUrl(
      'https://stock.example.com/',
      'VWRA.L',
      { theme: 'dark', locale: 'pl-PL' },
      'https://portfolio.example.com',
    )).toBe('https://stock.example.com/?uiTheme=dark&uiLocale=pl-PL&s=VWRA.L')
  })

  it('returns null for missing or invalid inputs', () => {
    expect(buildStockAnalystAnalysisUrl(null, 'VWRA.L')).toBeNull()
    expect(buildStockAnalystAnalysisUrl('https://stock.example.com/', '')).toBeNull()
    expect(buildStockAnalystAnalysisUrl('not-a-url', 'VWRA.L')).toBeNull()
    expect(buildStockAnalystAnalysisUrl('javascript:alert(1)', 'VWRA.L')).toBeNull()
  })
})
