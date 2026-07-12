import { describe, expect, it } from 'vitest'
import { resolveChartPalette, resolveShowChartAttribution } from './chart-theme'

describe('chart theme', () => {
  it('resolves chart colors from the public semantic and component token layers', () => {
    const values: Record<string, string> = {
      '--ui-chart-series-1': '#123456',
      '--ui-chart-series-4': '#654321',
      '--ui-chart-series-5': '#abcdef',
      '--ui-chart-up': '#00aa55',
      '--ui-chart-text': '#eeeeee',
      '--ui-chart-grid': '#222222',
      '--ui-chart-scale-border': '#333333',
      '--ui-color-border-strong': '#444444',
      '--ui-color-text-muted': '#777777',
      '--ui-color-text-secondary': '#bbbbbb',
      '--ui-color-highlight': '#ffaa00',
    }

    const palette = resolveChartPalette((name) => values[name] ?? '')

    expect(palette.portfolio).toBe('#123456')
    expect(palette.performance).toBe('#00aa55')
    expect(palette.usd).toBe('#abcdef')
    expect(palette.portfolioFill).toBe('rgba(18, 52, 86, 0.18)')
    expect(palette.bondFill).toBe('rgba(101, 67, 33, 0.15)')
    expect(palette.text).toBe('#eeeeee')
    expect(palette.crosshair).toBe('#444444')
  })

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
