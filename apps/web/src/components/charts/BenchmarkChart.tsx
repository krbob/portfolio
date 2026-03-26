import { useCallback } from 'react'
import { LineSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { useI18n } from '../../lib/i18n'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

interface BenchmarkChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
}

const benchmarkPriceFormat = { type: 'price' as const, minMove: 0.01, precision: 2 }

export function BenchmarkChart({ points, height = 300 }: BenchmarkChartProps) {
  const { isPolish } = useI18n()
  const onChart = useCallback(
    (chart: IChartApi) => {
      chart.addSeries(LineSeries, {
        color: chartPalette.portfolio,
        lineWidth: 3,
        priceFormat: benchmarkPriceFormat,
      }).setData(toLineData(points, 'portfolioPerformanceIndex'))

      chart.addSeries(LineSeries, {
        color: chartPalette.vwra,
        lineWidth: 2,
        lineStyle: 2,
        priceFormat: benchmarkPriceFormat,
      }).setData(toLineData(points, 'equityBenchmarkIndex'))

      chart.addSeries(LineSeries, {
        color: chartPalette.inflation,
        lineWidth: 2,
        lineStyle: 3,
        priceFormat: benchmarkPriceFormat,
      }).setData(toLineData(points, 'inflationBenchmarkIndex'))

      chart.addSeries(LineSeries, {
        color: chartPalette.targetMix,
        lineWidth: 2,
        lineStyle: 1,
        priceFormat: benchmarkPriceFormat,
      }).setData(toLineData(points, 'targetMixBenchmarkIndex'))

      chart.timeScale().fitContent()
    },
    [points],
  )

  return (
    <ChartContainer
      height={height}
      title={isPolish ? 'Porównanie benchmarków' : 'Benchmark Comparison'}
      subtitle={isPolish ? 'Indeksowane do 100 na początku wybranego okresu' : 'Indexed to 100 at the start of the selected period'}
      legend={
        <>
          <ChartLegendItem color={chartPalette.portfolio} label={isPolish ? 'Portfel' : 'Portfolio'} />
          <ChartLegendItem color={chartPalette.vwra} label="VWRA" dashed />
          <ChartLegendItem color={chartPalette.inflation} label={isPolish ? 'Inflacja' : 'Inflation'} dashed />
          <ChartLegendItem color={chartPalette.targetMix} label={isPolish ? 'Miks docelowy' : 'Target mix'} dashed />
        </>
      }
      onChart={onChart}
    />
  )
}

function toLineData(
  points: PortfolioDailyHistoryPoint[],
  key: 'portfolioPerformanceIndex' | 'equityBenchmarkIndex' | 'inflationBenchmarkIndex' | 'targetMixBenchmarkIndex',
) {
  return points
    .filter((p) => p[key] != null)
    .map((p) => ({ time: p.date, value: Number(p[key]) }))
}
