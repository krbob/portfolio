import { describe, expect, it } from 'vitest'
import { buildEdoSeriesName, edoYearOptions } from './edo-series'

describe('edo-series helpers', () => {
  it('keeps historical EDO years available for new instruments', () => {
    expect(edoYearOptions(undefined, 2026)).toContain('2005')
    expect(edoYearOptions(undefined, 2026)).toContain('2028')
  })

  it('preserves an edited year even when it is outside the rolling range', () => {
    expect(edoYearOptions(2032, 2026)).toContain('2032')
  })

  it('builds EDO series names from the selected month', () => {
    expect(buildEdoSeriesName('2026-03')).toBe('EDO0336')
    expect(buildEdoSeriesName('invalid')).toBe('EDO')
  })
})
