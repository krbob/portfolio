import { describe, expect, it } from 'vitest'
import { resolveShowChartAttribution } from './chart-theme'

describe('chart theme', () => {
  it('shows TradingView attribution by default', () => {
    expect(resolveShowChartAttribution(undefined, undefined)).toBe(true)
  })

  it('can hide TradingView attribution from build-time env', () => {
    expect(resolveShowChartAttribution(undefined, 'false')).toBe(false)
    expect(resolveShowChartAttribution(undefined, '0')).toBe(false)
    expect(resolveShowChartAttribution(undefined, 'no')).toBe(false)
    expect(resolveShowChartAttribution(undefined, 'off')).toBe(false)
  })

  it('prefers runtime config over build-time env', () => {
    expect(resolveShowChartAttribution(true, 'false')).toBe(true)
    expect(resolveShowChartAttribution(false, 'true')).toBe(false)
    expect(resolveShowChartAttribution('false', 'true')).toBe(false)
  })
})
