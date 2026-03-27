import { useCallback, useMemo, useState } from 'react'
import { LineSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { useI18n } from '../../lib/i18n'
import { filterInput } from '../../lib/styles'
import { t } from '../../lib/messages'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

const BENCHMARK_COLORS: Record<string, string> = {
  VWRA: chartPalette.vwra,
  INFLATION: chartPalette.inflation,
  TARGET_MIX: chartPalette.targetMix,
  V80A: '#8b5cf6',
  V60A: '#a78bfa',
  V40A: '#c4b5fd',
  V20A: '#ddd6fe',
  CUSTOM: '#f472b6',
}

const BENCHMARK_LABELS: Record<string, { pl: string; en: string }> = {
  VWRA: { pl: 'VWRA (akcje globalne)', en: 'VWRA (global equity)' },
  INFLATION: { pl: 'Inflacja', en: 'Inflation' },
  TARGET_MIX: { pl: 'Miks docelowy', en: 'Target mix' },
  V80A: { pl: 'V80A (80/20)', en: 'V80A (80/20)' },
  V60A: { pl: 'V60A (60/40)', en: 'V60A (60/40)' },
  V40A: { pl: 'V40A (40/60)', en: 'V40A (40/60)' },
  V20A: { pl: 'V20A (20/80)', en: 'V20A (20/80)' },
  CUSTOM: { pl: 'Własny benchmark', en: 'Custom benchmark' },
}

const DEFAULT_BENCHMARK_COLOR = '#a1a1aa'

interface BenchmarkChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
  customBenchmarkLabel?: string
}

const benchmarkPriceFormat = { type: 'price' as const, minMove: 0.01, precision: 2 }

export function BenchmarkChart({ points, height = 300, customBenchmarkLabel }: BenchmarkChartProps) {
  const { isPolish } = useI18n()

  const availableKeys = useMemo(() => {
    if (points.length === 0) return []
    const keysWithData = new Set<string>()
    for (const point of points) {
      if (point.benchmarkIndices) {
        for (const key of Object.keys(point.benchmarkIndices)) {
          keysWithData.add(key)
        }
      }
    }
    const preferred = ['VWRA', 'V80A', 'V60A', 'V40A', 'V20A', 'CUSTOM', 'INFLATION', 'TARGET_MIX']
    return preferred.filter((k) => keysWithData.has(k))
  }, [points])

  const [selected, setSelected] = useState<string | null>(null)
  const activeKey = selected != null && availableKeys.includes(selected) ? selected : availableKeys[0] ?? 'VWRA'

  const color = BENCHMARK_COLORS[activeKey] ?? DEFAULT_BENCHMARK_COLOR
  const label = BENCHMARK_LABELS[activeKey]
  const displayLabel = activeKey === 'CUSTOM' && customBenchmarkLabel
    ? customBenchmarkLabel
    : label ? (isPolish ? label.pl : label.en) : activeKey

  const onChart = useCallback(
    (chart: IChartApi) => {
      chart.addSeries(LineSeries, {
        color: chartPalette.portfolio,
        lineWidth: 3,
        priceFormat: benchmarkPriceFormat,
      }).setData(
        points
          .filter((p) => p.portfolioPerformanceIndex != null)
          .map((p) => ({ time: p.date, value: Number(p.portfolioPerformanceIndex) })),
      )

      chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: 2,
        priceFormat: benchmarkPriceFormat,
      }).setData(
        points
          .filter((p) => p.benchmarkIndices?.[activeKey] != null)
          .map((p) => ({ time: p.date, value: Number(p.benchmarkIndices![activeKey]) })),
      )

      chart.timeScale().fitContent()
    },
    [points, activeKey, color],
  )

  return (
    <ChartContainer
      height={height}
      title={t('benchmark.title')}
      subtitle={t('benchmark.subtitle')}
      legend={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ChartLegendItem color={chartPalette.portfolio} label={t('benchmark.portfolio')} />
          <ChartLegendItem color={color} label={displayLabel} dashed />
          {availableKeys.length > 1 && (
            <select
              className={`${filterInput} ml-auto`}
              value={activeKey}
              onChange={(e) => setSelected(e.target.value)}
              aria-label={t('benchmark.selectLabel')}
            >
              {availableKeys.map((key) => {
                const l = BENCHMARK_LABELS[key]
                const optionLabel = key === 'CUSTOM' && customBenchmarkLabel
                  ? customBenchmarkLabel
                  : l ? (isPolish ? l.pl : l.en) : key
                return (
                  <option key={key} value={key}>{optionLabel}</option>
                )
              })}
            </select>
          )}
        </div>
      }
      onChart={onChart}
    />
  )
}
