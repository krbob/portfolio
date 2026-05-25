import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { PerformanceIndexChart } from './PerformanceIndexChart'

const {
  LineSeriesToken,
  chart,
  chartAddSeriesMock,
  chartRemoveMock,
  createChartMock,
  fitContentMock,
  portfolioSeries,
  benchmarkSeries,
} = vi.hoisted(() => {
  const portfolioSeries = {
    applyOptions: vi.fn(),
    setData: vi.fn(),
  }
  const benchmarkSeries = {
    applyOptions: vi.fn(),
    setData: vi.fn(),
  }
  const fitContentMock = vi.fn()
  const chartRemoveMock = vi.fn()
  const chartAddSeriesMock = vi.fn()
  const chart = {
    addSeries: chartAddSeriesMock,
    applyOptions: vi.fn(),
    removeSeries: vi.fn(),
    remove: chartRemoveMock,
    timeScale: () => ({ fitContent: fitContentMock }),
  }

  return {
    LineSeriesToken: Symbol('LineSeries'),
    chart,
    chartAddSeriesMock,
    chartRemoveMock,
    createChartMock: vi.fn(),
    fitContentMock,
    portfolioSeries,
    benchmarkSeries,
  }
})

vi.mock('lightweight-charts', () => ({
  LineSeries: LineSeriesToken,
  LineStyle: { Solid: 0, Dashed: 2 },
  ColorType: { Solid: 'solid' },
  createChart: createChartMock,
}))

vi.mock('../../lib/chart-theme', async () => {
  const actual = await vi.importActual<typeof import('../../lib/chart-theme')>('../../lib/chart-theme')
  return {
    ...actual,
    isInteractiveChartEnvironment: () => true,
  }
})

const basePoint: PortfolioDailyHistoryPoint = {
  date: '2026-01-01',
  totalBookValuePln: '1000.00',
  totalCurrentValuePln: '1000.00',
  netContributionsPln: '1000.00',
  cashBalancePln: '1000.00',
  totalCurrentValueUsd: null,
  netContributionsUsd: null,
  cashBalanceUsd: null,
  totalCurrentValueAu: null,
  netContributionsAu: null,
  cashBalanceAu: null,
  equityCurrentValuePln: '1000.00',
  bondCurrentValuePln: '0.00',
  cashCurrentValuePln: '0.00',
  equityAllocationPct: '100.00',
  bondAllocationPct: '0.00',
  cashAllocationPct: '0.00',
  portfolioPerformanceIndex: '101.33',
  benchmarkIndices: { WIG20: '108.00' },
  activeHoldingCount: 1,
  valuedHoldingCount: 1,
}

describe('PerformanceIndexChart', () => {
  beforeEach(() => {
    chartAddSeriesMock.mockReset()
    chartRemoveMock.mockReset()
    createChartMock.mockReset()
    fitContentMock.mockReset()
    portfolioSeries.applyOptions.mockReset()
    portfolioSeries.setData.mockReset()
    benchmarkSeries.applyOptions.mockReset()
    benchmarkSeries.setData.mockReset()

    chartAddSeriesMock
      .mockReturnValueOnce(portfolioSeries)
      .mockReturnValueOnce(benchmarkSeries)
    createChartMock.mockReturnValue(chart)

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    })
  })

  afterEach(() => cleanup())

  it('rebases every visible index series to 100 at the start of the selected range', () => {
    const points: PortfolioDailyHistoryPoint[] = [
      basePoint,
      {
        ...basePoint,
        date: '2026-05-24',
        portfolioPerformanceIndex: '110.85',
        benchmarkIndices: { WIG20: '123.19' },
      },
    ]

    render(
      <PerformanceIndexChart
        points={points}
        series={[
          {
            id: 'portfolio',
            color: '#3b82f6',
            getValue: (point) => point.portfolioPerformanceIndex,
          },
          {
            id: 'benchmark:WIG20',
            color: '#a1a1aa',
            getValue: (point) => point.benchmarkIndices?.WIG20,
          },
        ]}
      />,
    )

    expect(portfolioSeries.setData).toHaveBeenCalledWith([
      { time: '2026-01-01', value: 100 },
      { time: '2026-05-24', value: expect.closeTo(109.395, 3) },
    ])
    expect(benchmarkSeries.setData).toHaveBeenCalledWith([
      { time: '2026-01-01', value: 100 },
      { time: '2026-05-24', value: expect.closeTo(114.065, 3) },
    ])
  })
})
