import { describe, expect, it } from 'vitest'
import { missingDataLabel, notApplicableLabel, unavailableLabel } from './availability'

describe('availability labels', () => {
  it('keeps date-style fallbacks separate from missing-data fallbacks', () => {
    expect(notApplicableLabel('pl')).toBe('n/d')
    expect(notApplicableLabel('en')).toBe('n/a')
    expect(missingDataLabel('pl')).toBe('b/d')
    expect(missingDataLabel('en')).toBe('N/A')
  })

  it('returns translated unavailable labels', () => {
    expect(unavailableLabel('pl')).toBe('Niedostępne')
    expect(unavailableLabel('en')).toBe('Unavailable')
  })
})
