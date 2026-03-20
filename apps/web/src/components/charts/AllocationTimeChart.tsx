import { useCallback } from 'react'
import { AreaSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { useI18n } from '../../lib/i18n'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

interface AllocationTimeChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
}

export function AllocationTimeChart({ points, height = 280 }: AllocationTimeChartProps) {
  const { isPolish } = useI18n()
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
      title={isPolish ? 'Historia alokacji' : 'Allocation History'}
      subtitle={isPolish ? 'Akcje, obligacje i gotówka jako procent portfela' : 'Equities, bonds and cash as percentage of portfolio'}
      legend={
        <>
          <ChartLegendItem color={chartPalette.equities} label={isPolish ? 'Akcje' : 'Equities'} />
          <ChartLegendItem color={chartPalette.bonds} label={isPolish ? 'Obligacje' : 'Bonds'} />
          <ChartLegendItem color={chartPalette.cash} label={isPolish ? 'Gotówka' : 'Cash'} />
        </>
      }
      onChart={onChart}
    />
  )
}
