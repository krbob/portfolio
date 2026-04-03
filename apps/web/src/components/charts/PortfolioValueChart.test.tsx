import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortfolioValueChart } from './PortfolioValueChart'

const {
  AreaSeriesToken,
  LineSeriesToken,
  chart,
  chartAddSeriesMock,
  chartApplyOptionsMock,
  chartRemoveMock,
  contributionsSeries,
  createChartMock,
  fitContentMock,
  valueSeries,
} = vi.hoisted(() => {
  const valueSeries = {
    applyOptions: vi.fn(),
    setData: vi.fn(),
  }
  const contributionsSeries = {
    applyOptions: vi.fn(),
    setData: vi.fn(),
  }
  const fitContentMock = vi.fn()
  const chartRemoveMock = vi.fn()
  const chartApplyOptionsMock = vi.fn()
  const chartAddSeriesMock = vi.fn()
  const chart = {
    addSeries: chartAddSeriesMock,
    applyOptions: chartApplyOptionsMock,
    remove: chartRemoveMock,
    timeScale: () => ({ fitContent: fitContentMock }),
  }

  return {
    AreaSeriesToken: Symbol('AreaSeries'),
    LineSeriesToken: Symbol('LineSeries'),
    chart,
    chartAddSeriesMock,
    chartApplyOptionsMock,
    chartRemoveMock,
    contributionsSeries,
    createChartMock: vi.fn(),
    fitContentMock,
    valueSeries,
  }
})

vi.mock('lightweight-charts', () => ({
  AreaSeries: AreaSeriesToken,
  LineSeries: LineSeriesToken,
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

describe('PortfolioValueChart', () => {
  beforeEach(() => {
    chartAddSeriesMock.mockReset()
    chartApplyOptionsMock.mockReset()
    chartRemoveMock.mockReset()
    createChartMock.mockReset()
    fitContentMock.mockReset()
    valueSeries.applyOptions.mockReset()
    valueSeries.setData.mockReset()
    contributionsSeries.applyOptions.mockReset()
    contributionsSeries.setData.mockReset()

    chartAddSeriesMock.mockImplementation((seriesType: symbol) => {
      if (seriesType === AreaSeriesToken) return valueSeries
      if (seriesType === LineSeriesToken) return contributionsSeries
      throw new Error(`Unexpected series type: ${String(seriesType)}`)
    })
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

  it('updates series data without recreating the chart instance', () => {
    const initialPoints = [
      {
        date: '2026-03-01',
        totalBookValuePln: '1000.00',
        totalCurrentValuePln: '1000.00',
        netContributionsPln: '800.00',
        cashBalancePln: '200.00',
        totalCurrentValueUsd: '250.00',
        netContributionsUsd: '200.00',
        cashBalanceUsd: '50.00',
        totalCurrentValueAu: null,
        netContributionsAu: null,
        cashBalanceAu: null,
        equityCurrentValuePln: '800.00',
        bondCurrentValuePln: '0.00',
        cashCurrentValuePln: '200.00',
        equityAllocationPct: '80.00',
        bondAllocationPct: '0.00',
        cashAllocationPct: '20.00',
        portfolioPerformanceIndex: '100.00',
        benchmarkIndices: { VWRA: '100.00' },
        activeHoldingCount: 1,
        valuedHoldingCount: 1,
      },
    ]
    const nextPoints = [
      ...initialPoints,
      {
        ...initialPoints[0],
        date: '2026-03-02',
        totalCurrentValuePln: '1200.00',
        netContributionsPln: '900.00',
        totalCurrentValueUsd: '300.00',
        netContributionsUsd: '225.00',
        equityCurrentValuePln: '1000.00',
        cashCurrentValuePln: '200.00',
      },
    ]

    const { rerender, unmount } = render(
      <PortfolioValueChart
        points={initialPoints}
        valueKey="totalCurrentValuePln"
        contributionsKey="netContributionsPln"
        unit="PLN"
      />,
    )

    expect(createChartMock).toHaveBeenCalledTimes(1)
    expect(chartAddSeriesMock).toHaveBeenCalledTimes(2)
    expect(valueSeries.setData).toHaveBeenCalledTimes(1)
    expect(contributionsSeries.setData).toHaveBeenCalledTimes(1)

    rerender(
      <PortfolioValueChart
        points={nextPoints}
        valueKey="totalCurrentValuePln"
        contributionsKey="netContributionsPln"
        unit="PLN"
      />,
    )

    expect(createChartMock).toHaveBeenCalledTimes(1)
    expect(chartAddSeriesMock).toHaveBeenCalledTimes(2)
    expect(chartRemoveMock).not.toHaveBeenCalled()
    expect(valueSeries.setData).toHaveBeenCalledTimes(2)
    expect(contributionsSeries.setData).toHaveBeenCalledTimes(2)

    unmount()

    expect(chartRemoveMock).toHaveBeenCalledTimes(1)
  })
})
