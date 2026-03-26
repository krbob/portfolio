import { describe, expect, it } from 'vitest'
import { missingDataLabel, notApplicableLabel, unavailableLabel } from './availability'

describe('availability labels', () => {
  it('keeps date-style fallbacks separate from missing-data fallbacks', () => {
    expect(notApplicableLabel(true)).toBe('n/d')
    expect(notApplicableLabel(false)).toBe('n/a')
    expect(missingDataLabel(true)).toBe('b/d')
    expect(missingDataLabel(false)).toBe('N/A')
  })

  it('returns translated unavailable labels', () => {
    expect(unavailableLabel(true)).toBe('Niedostępne')
    expect(unavailableLabel(false)).toBe('Unavailable')
  })
})
