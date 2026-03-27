import { useCallback, useState } from 'react'
import { LineSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { useI18n } from '../../lib/i18n'
import { filterInput } from '../../lib/styles'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

type BenchmarkKey = 'equityBenchmarkIndex' | 'inflationBenchmarkIndex' | 'targetMixBenchmarkIndex'

const BENCHMARK_OPTIONS: Array<{ key: BenchmarkKey; color: string; plLabel: string; enLabel: string }> = [
  { key: 'equityBenchmarkIndex', color: chartPalette.vwra, plLabel: 'Benchmark akcji', enLabel: 'Equity benchmark' },
  { key: 'inflationBenchmarkIndex', color: chartPalette.inflation, plLabel: 'Inflacja', enLabel: 'Inflation' },
  { key: 'targetMixBenchmarkIndex', color: chartPalette.targetMix, plLabel: 'Miks docelowy', enLabel: 'Target mix' },
]

interface BenchmarkChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
}

const benchmarkPriceFormat = { type: 'price' as const, minMove: 0.01, precision: 2 }

export function BenchmarkChart({ points, height = 300 }: BenchmarkChartProps) {
  const { isPolish } = useI18n()
  const [selected, setSelected] = useState<BenchmarkKey>('equityBenchmarkIndex')

  const option = BENCHMARK_OPTIONS.find((o) => o.key === selected) ?? BENCHMARK_OPTIONS[0]

  const onChart = useCallback(
    (chart: IChartApi) => {
      chart.addSeries(LineSeries, {
        color: chartPalette.portfolio,
        lineWidth: 3,
        priceFormat: benchmarkPriceFormat,
      }).setData(toLineData(points, 'portfolioPerformanceIndex'))

      chart.addSeries(LineSeries, {
        color: option.color,
        lineWidth: 2,
        lineStyle: 2,
        priceFormat: benchmarkPriceFormat,
      }).setData(toLineData(points, selected))

      chart.timeScale().fitContent()
    },
    [points, selected, option.color],
  )

  return (
    <ChartContainer
      height={height}
      title={isPolish ? 'Porównanie z benchmarkiem' : 'Benchmark Comparison'}
      subtitle={isPolish ? 'Indeksowane do 100 na początku wybranego okresu' : 'Indexed to 100 at the start of the selected period'}
      legend={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ChartLegendItem color={chartPalette.portfolio} label={isPolish ? 'Portfel' : 'Portfolio'} />
          <ChartLegendItem color={option.color} label={isPolish ? option.plLabel : option.enLabel} dashed />
          <select
            className={`${filterInput} ml-auto`}
            value={selected}
            onChange={(e) => setSelected(e.target.value as BenchmarkKey)}
            aria-label={isPolish ? 'Wybierz benchmark' : 'Select benchmark'}
          >
            {BENCHMARK_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{isPolish ? o.plLabel : o.enLabel}</option>
            ))}
          </select>
        </div>
      }
      onChart={onChart}
    />
  )
}

function toLineData(
  points: PortfolioDailyHistoryPoint[],
  key: 'portfolioPerformanceIndex' | BenchmarkKey,
) {
  return points
    .filter((p) => p[key] != null)
    .map((p) => ({ time: p.date, value: Number(p[key]) }))
}
