import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LineSeries, type IChartApi, type ISeriesApi, type SeriesType } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { orderAvailableBenchmarkKeys } from '../../lib/benchmarks'
import { chartPalette } from '../../lib/chart-theme'
import { useI18n } from '../../lib/i18n'
import { filterInput } from '../../lib/styles'
import { t } from '../../lib/messages'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

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

const BENCHMARK_LINE_COLOR = '#a1a1aa' // zinc-400 — stable color for all benchmarks

interface BenchmarkChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
  customBenchmarkLabel?: string
  benchmarkOrder?: string[]
}

const benchmarkPriceFormat = { type: 'price' as const, minMove: 0.01, precision: 2 }

export function BenchmarkChart({
  points,
  height = 300,
  customBenchmarkLabel,
  benchmarkOrder,
}: BenchmarkChartProps) {
  const { language } = useI18n()
  const benchmarkSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const chartRef = useRef<IChartApi | null>(null)

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
    return orderAvailableBenchmarkKeys(keysWithData, benchmarkOrder)
  }, [benchmarkOrder, points])

  const [selected, setSelected] = useState<string | null>(null)
  const activeKey = selected != null && availableKeys.includes(selected) ? selected : availableKeys[0] ?? 'VWRA'

  const label = BENCHMARK_LABELS[activeKey]
  const displayLabel = activeKey === 'CUSTOM' && customBenchmarkLabel
    ? customBenchmarkLabel
    : label ? (language === 'pl' ? label.pl : label.en) : activeKey

  // Initial chart setup — only depends on points (not activeKey)
  const onChart = useCallback(
    (chart: IChartApi) => {
      chartRef.current = chart

      chart.addSeries(LineSeries, {
        color: chartPalette.portfolio,
        lineWidth: 3,
        priceFormat: benchmarkPriceFormat,
      }).setData(
        points
          .filter((p) => p.portfolioPerformanceIndex != null)
          .map((p) => ({ time: p.date, value: Number(p.portfolioPerformanceIndex) })),
      )

      const benchmarkSeries = chart.addSeries(LineSeries, {
        color: BENCHMARK_LINE_COLOR,
        lineWidth: 2,
        lineStyle: 2,
        priceFormat: benchmarkPriceFormat,
      })
      benchmarkSeriesRef.current = benchmarkSeries

      chart.timeScale().fitContent()

      return () => {
        chartRef.current = null
        benchmarkSeriesRef.current = null
      }
    },
    [points],
  )

  // Update benchmark series data when activeKey changes — no chart remount
  useEffect(() => {
    const series = benchmarkSeriesRef.current
    if (!series) return

    series.setData(
      points
        .filter((p) => p.benchmarkIndices?.[activeKey] != null)
        .map((p) => ({ time: p.date, value: Number(p.benchmarkIndices![activeKey]) })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [activeKey, points])

  return (
    <ChartContainer
      height={height}
      title={t('benchmark.title')}
      subtitle={t('benchmark.subtitle')}
      legend={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ChartLegendItem color={chartPalette.portfolio} label={t('benchmark.portfolio')} />
          <ChartLegendItem color={BENCHMARK_LINE_COLOR} label={displayLabel} dashed />
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
                  : l ? (language === 'pl' ? l.pl : l.en) : key
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
