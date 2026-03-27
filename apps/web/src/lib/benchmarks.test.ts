import { describe, expect, it } from 'vitest'
import { orderAvailableBenchmarkKeys, resolveBenchmarkOrder } from './benchmarks'

describe('benchmarks helpers', () => {
  it('resolves benchmark order from enabled and pinned settings', () => {
    expect(resolveBenchmarkOrder({
      enabledKeys: ['CUSTOM', 'VWRA'],
      pinnedKeys: ['CUSTOM'],
      customLabel: 'Europa 600',
      customSymbol: 'EXSA.DE',
      options: [
        { key: 'VWRA', label: 'VWRA benchmark', symbol: 'VWRA.L', kind: 'ETF', configurable: true, defaultEnabled: true, defaultPinned: true },
        { key: 'TARGET_MIX', label: 'Configured target mix', symbol: null, kind: 'SYSTEM', configurable: false, defaultEnabled: true, defaultPinned: false },
        { key: 'CUSTOM', label: 'Custom benchmark', symbol: 'EXSA.DE', kind: 'ETF', configurable: true, defaultEnabled: false, defaultPinned: false },
      ],
    })).toEqual(['CUSTOM', 'VWRA'])
  })

  it('orders available keys using configured preference when present', () => {
    expect(orderAvailableBenchmarkKeys(['VWRA', 'CUSTOM', 'TARGET_MIX'], ['CUSTOM', 'VWRA'])).toEqual(['CUSTOM', 'VWRA'])
  })

  it('falls back to default order and appends unknown keys deterministically', () => {
    expect(orderAvailableBenchmarkKeys(['TARGET_MIX', 'ZZZ', 'VWRA', 'CUSTOM'])).toEqual(['VWRA', 'CUSTOM', 'TARGET_MIX', 'ZZZ'])
  })
})
