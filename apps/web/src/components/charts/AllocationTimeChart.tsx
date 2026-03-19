import { useCallback } from 'react'
import { AreaSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

interface AllocationTimeChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
}

export function AllocationTimeChart({ points, height = 280 }: AllocationTimeChartProps) {
  const onChart = useCallback(
    (chart: IChartApi) => {
      const equitySeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.equities,
        topColor: chartPalette.equityFill,
        bottomColor: chartPalette.equityFade,
        lineWidth: 2,
      })
      const bondSeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.bonds,
        topColor: chartPalette.bondFill,
        bottomColor: chartPalette.bondFade,
        lineWidth: 2,
      })
      const cashSeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.cash,
        topColor: chartPalette.cashFill,
        bottomColor: chartPalette.cashFade,
        lineWidth: 2,
      })

      equitySeries.setData(points.map((p) => ({ time: p.date, value: Number(p.equityAllocationPct) })))
      bondSeries.setData(points.map((p) => ({ time: p.date, value: Number(p.bondAllocationPct) })))
      cashSeries.setData(points.map((p) => ({ time: p.date, value: Number(p.cashAllocationPct) })))
      chart.timeScale().fitContent()
    },
    [points],
  )

  return (
    <ChartContainer
      height={height}
      title="Allocation History"
      subtitle="Equities, bonds and cash as percentage of portfolio"
      legend={
        <>
          <ChartLegendItem color={chartPalette.equities} label="Equities" />
          <ChartLegendItem color={chartPalette.bonds} label="Bonds" />
          <ChartLegendItem color={chartPalette.cash} label="Cash" />
        </>
      }
      onChart={onChart}
    />
  )
}
