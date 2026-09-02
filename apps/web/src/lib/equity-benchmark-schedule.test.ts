import { describe, expect, it } from 'vitest'
import {
  isValidBenchmarkSymbol,
  normalizeBenchmarkSymbol,
  validateEquityBenchmarkSchedule,
} from './equity-benchmark-schedule'

describe('equity benchmark schedule helpers', () => {
  it('normalizes symbols and accepts the supported market-symbol format', () => {
    expect(normalizeBenchmarkSymbol('vgla.l')).toBe('VGLA.L')
    expect(isValidBenchmarkSymbol(' vgla.l ')).toBe(true)
    expect(isValidBenchmarkSymbol('VGLA/L')).toBe(false)
  })

  it('requires symbols in every phase and dates after the baseline phase', () => {
    expect(validateEquityBenchmarkSchedule([
      { effectiveFrom: '', symbol: '' },
      { effectiveFrom: '', symbol: 'VGLA.L' },
    ])).toEqual([
      { symbolError: 'REQUIRED', dateError: null, valid: false },
      { symbolError: null, dateError: 'REQUIRED', valid: false },
    ])
  })

  it('rejects dates that are not strictly increasing', () => {
    const validations = validateEquityBenchmarkSchedule([
      { effectiveFrom: '', symbol: 'VWRA.L' },
      { effectiveFrom: '2026-08-25', symbol: 'VGLA.L' },
      { effectiveFrom: '2026-08-25', symbol: 'NEW.L' },
      { effectiveFrom: '2026-08-20', symbol: 'NEXT.L' },
    ])

    expect(validations.map((validation) => validation.dateError)).toEqual([
      null,
      null,
      'NOT_INCREASING',
      'NOT_INCREASING',
    ])
  })

  it('accepts a complete strictly increasing schedule', () => {
    expect(validateEquityBenchmarkSchedule([
      { effectiveFrom: '', symbol: 'VWRA.L' },
      { effectiveFrom: '2026-08-25', symbol: 'VGLA.L' },
      { effectiveFrom: '2031-01-01', symbol: 'NEXT.L' },
    ]).every((validation) => validation.valid)).toBe(true)
  })
})
