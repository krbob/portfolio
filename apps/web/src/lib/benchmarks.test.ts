import { describe, expect, it } from 'vitest'
import { orderAvailableBenchmarkKeys, resolveBenchmarkOrder } from './benchmarks'

describe('benchmarks helpers', () => {
  it('resolves benchmark order from enabled and pinned settings', () => {
    expect(resolveBenchmarkOrder({
      enabledKeys: ['CUSTOM_1', 'VWRA'],
      pinnedKeys: ['CUSTOM_1'],
      customBenchmarks: [
        { key: 'CUSTOM_1', label: 'Europa 600', symbol: 'EXSA.DE' },
      ],
      options: [
        { key: 'VWRA', label: 'VWRA benchmark', symbol: 'VWRA.L', kind: 'ETF', configurable: true, defaultEnabled: true, defaultPinned: true },
        { key: 'TARGET_MIX', label: 'Configured target mix', symbol: null, kind: 'SYSTEM', configurable: false, defaultEnabled: true, defaultPinned: false },
        { key: 'CUSTOM_1', label: 'Europa 600', symbol: 'EXSA.DE', kind: 'CUSTOM', configurable: true, defaultEnabled: false, defaultPinned: false },
      ],
    })).toEqual(['CUSTOM_1', 'VWRA'])
  })

  it('orders available keys using configured preference when present', () => {
    expect(orderAvailableBenchmarkKeys(['VWRA', 'CUSTOM_1', 'TARGET_MIX'], ['CUSTOM_1', 'VWRA'])).toEqual(['CUSTOM_1', 'VWRA'])
  })

  it('falls back to default order and appends unknown keys deterministically', () => {
    expect(orderAvailableBenchmarkKeys(['TARGET_MIX', 'ZZZ', 'VWRA', 'CUSTOM_2', 'VAGF'])).toEqual(['VWRA', 'VAGF', 'CUSTOM_2', 'TARGET_MIX', 'ZZZ'])
  })
})
