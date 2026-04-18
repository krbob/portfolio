import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LineSeries, type IChartApi, type ISeriesApi, type SeriesType } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { orderAvailableBenchmarkKeys } from '../../lib/benchmarks'
import { chartPalette } from '../../lib/chart-theme'
import { useI18n } from '../../lib/i18n'
import { filterInput } from '../../lib/styles'
import { t } from '../../lib/messages'
import { ChartContainer, ChartLegendItem } from './ChartContainer'
import { SegmentedControl } from '../ui'

const BENCHMARK_LABELS: Record<string, { pl: string; en: string }> = {
  VWRA: { pl: 'VWRA (akcje globalne)', en: 'VWRA (global equity)' },
  INFLATION: { pl: 'Inflacja', en: 'Inflation' },
  TARGET_MIX: { pl: 'Miks docelowy', en: 'Target mix' },
  V80A: { pl: 'V80A (80/20)', en: 'V80A (80/20)' },
  V60A: { pl: 'V60A (60/40)', en: 'V60A (60/40)' },
  V40A: { pl: 'V40A (40/60)', en: 'V40A (40/60)' },
  V20A: { pl: 'V20A (20/80)', en: 'V20A (20/80)' },
  VAGF: { pl: 'VAGF (obligacje globalne)', en: 'VAGF (global bonds)' },
}

const BENCHMARK_LINE_COLOR = '#a1a1aa' // zinc-400 — stable color for all benchmarks
const BENCHMARK_COMPARE_COLORS = ['#a1a1aa', '#f59e0b', '#22c55e'] as const

type BenchmarkChartMode = 'single' | 'compare'

interface BenchmarkChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
  customBenchmarkLabels?: Record<string, string>
  benchmarkOrder?: string[]
  pinnedBenchmarkKeys?: string[]
}

const benchmarkPriceFormat = { type: 'price' as const, minMove: 0.01, precision: 2 }

export function BenchmarkChart({
  points,
  height = 300,
  customBenchmarkLabels,
  benchmarkOrder,
  pinnedBenchmarkKeys,
}: BenchmarkChartProps) {
  const { language } = useI18n()
  const benchmarkSeriesRef = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map())
  const hasMountedRef = useRef(false)
  const portfolioSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const dataRef = useRef({
    points,
    mode: 'single' as BenchmarkChartMode,
    activeKey: 'VWRA',
    compareKeys: [] as string[],
  })

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

  const defaultCompareKeys = useMemo(() => {
    const pinnedSet = new Set(pinnedBenchmarkKeys ?? [])
    const pinnedAvailable = availableKeys.filter((key) => pinnedSet.has(key))
    const preferred = pinnedAvailable.length > 1 ? pinnedAvailable : availableKeys
    return preferred.slice(0, Math.min(3, preferred.length))
  }, [availableKeys, pinnedBenchmarkKeys])
  const shouldDefaultCompare = useMemo(() => {
    const pinnedSet = new Set(pinnedBenchmarkKeys ?? [])
    return availableKeys.filter((key) => pinnedSet.has(key)).length > 1
  }, [availableKeys, pinnedBenchmarkKeys])

  const [mode, setMode] = useState<BenchmarkChartMode>(() => (shouldDefaultCompare ? 'compare' : 'single'))
  const [selected, setSelected] = useState<string | null>(null)
  const [compareKeys, setCompareKeys] = useState<string[]>(defaultCompareKeys)
  const activeKey = selected != null && availableKeys.includes(selected) ? selected : availableKeys[0] ?? 'VWRA'
  const resolvedCompareKeys = useMemo(
    () => normalizeCompareKeys(compareKeys, availableKeys, defaultCompareKeys),
    [availableKeys, compareKeys, defaultCompareKeys],
  )

  useEffect(() => {
    if (availableKeys.length <= 1) {
      setMode('single')
      return
    }
    if (mode === 'compare' && resolvedCompareKeys.length === 0 && defaultCompareKeys.length > 0) {
      setCompareKeys(defaultCompareKeys)
    }
  }, [availableKeys.length, defaultCompareKeys, mode, resolvedCompareKeys.length])

  dataRef.current = {
    points,
    mode,
    activeKey,
    compareKeys: resolvedCompareKeys,
  }

  const displayLabel = labelForBenchmarkKey(activeKey, language, customBenchmarkLabels)

  const updateSeriesData = useCallback(() => {
    const { points: currentPoints, activeKey: currentActiveKey, mode: currentMode, compareKeys: currentCompareKeys } = dataRef.current
    portfolioSeriesRef.current?.setData(
      currentPoints
        .filter((point) => point.portfolioPerformanceIndex != null)
        .map((point) => ({ time: point.date, value: Number(point.portfolioPerformanceIndex) })),
    )
    const desiredKeys = currentMode === 'compare' ? currentCompareKeys : [currentActiveKey]
    const currentSeries = benchmarkSeriesRef.current
    currentSeries.forEach((series, key) => {
      if (!desiredKeys.includes(key)) {
        chartRef.current?.removeSeries(series)
        currentSeries.delete(key)
      }
    })

    desiredKeys.forEach((key, index) => {
      const color = currentMode === 'compare'
        ? BENCHMARK_COMPARE_COLORS[index % BENCHMARK_COMPARE_COLORS.length]
        : BENCHMARK_LINE_COLOR
      let series = currentSeries.get(key)
      if (!series && chartRef.current) {
        series = chartRef.current.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: currentMode === 'compare' ? 0 : 2,
          priceFormat: benchmarkPriceFormat,
        })
        currentSeries.set(key, series)
      }
      series?.applyOptions({
        color,
        lineStyle: currentMode === 'compare' ? 0 : 2,
      })
      series?.setData(
        currentPoints
          .filter((point) => point.benchmarkIndices?.[key] != null)
          .map((point) => ({ time: point.date, value: Number(point.benchmarkIndices![key]) })),
      )
    })
    chartRef.current?.timeScale().fitContent()
  }, [])

  const onChartReady = useCallback((chart: IChartApi) => {
    chartRef.current = chart
    portfolioSeriesRef.current = chart.addSeries(LineSeries, {
      color: chartPalette.portfolio,
      lineWidth: 3,
      priceFormat: benchmarkPriceFormat,
    })
    benchmarkSeriesRef.current = new Map()

    updateSeriesData()

    return () => {
      chartRef.current = null
      portfolioSeriesRef.current = null
      benchmarkSeriesRef.current = new Map()
    }
  }, [updateSeriesData])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    updateSeriesData()
  }, [activeKey, compareKeys, mode, points, updateSeriesData])

  const compareLegendItems = resolvedCompareKeys.map((key, index) => ({
    key,
    label: labelForBenchmarkKey(key, language, customBenchmarkLabels),
    color: BENCHMARK_COMPARE_COLORS[index % BENCHMARK_COMPARE_COLORS.length],
  }))

  function toggleCompareKey(key: string) {
    setCompareKeys((current) => {
      if (current.includes(key)) {
        return current.length > 1 ? current.filter((candidate) => candidate !== key) : current
      }
      if (current.length >= 3) {
        return current
      }
      return [...current, key]
    })
  }

  return (
    <ChartContainer
      height={height}
      title={t('benchmark.title')}
      subtitle={t('benchmark.subtitle')}
      legend={
        <div className="flex max-w-[720px] flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <ChartLegendItem color={chartPalette.portfolio} label={t('benchmark.portfolio')} />
          {mode === 'compare'
            ? compareLegendItems.map((item) => (
                <ChartLegendItem key={item.key} color={item.color} label={item.label} />
              ))
            : <ChartLegendItem color={BENCHMARK_LINE_COLOR} label={displayLabel} dashed />}
          {availableKeys.length > 1 ? (
            <>
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value)}
                ariaLabel={t('benchmark.modeLabel')}
                options={[
                  { value: 'single', label: t('benchmark.modeSingle') },
                  { value: 'compare', label: t('benchmark.modeCompare') },
                ]}
              />
              {mode === 'single' ? (
                <select
                  className={filterInput}
                  value={activeKey}
                  onChange={(e) => setSelected(e.target.value)}
                  aria-label={t('benchmark.selectLabel')}
                >
                  {availableKeys.map((key) => (
                    <option key={key} value={key}>{labelForBenchmarkKey(key, language, customBenchmarkLabels)}</option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {availableKeys.map((key) => {
                    const isSelected = resolvedCompareKeys.includes(key)
                    const disabled = !isSelected && resolvedCompareKeys.length >= 3
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 sm:py-1 text-xs transition-colors ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/15 text-blue-100'
                            : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
                        } ${
                          disabled ? 'cursor-not-allowed opacity-40' : ''
                        }`}
                        onClick={() => toggleCompareKey(key)}
                        disabled={disabled}
                        aria-pressed={isSelected}
                      >
                        {labelForBenchmarkKey(key, language, customBenchmarkLabels)}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      }
      onChartReady={onChartReady}
    />
  )
}

function normalizeCompareKeys(
  keys: string[],
  availableKeys: string[],
  defaultKeys: string[],
): string[] {
  const normalized = keys.filter((key, index) => availableKeys.includes(key) && keys.indexOf(key) === index)
  if (normalized.length > 0) {
    return normalized.slice(0, 3)
  }
  return defaultKeys.filter((key) => availableKeys.includes(key)).slice(0, 3)
}

function labelForBenchmarkKey(
  key: string,
  language: 'pl' | 'en',
  customBenchmarkLabels?: Record<string, string>,
): string {
  const customLabel = customBenchmarkLabels?.[key]
  if (customLabel) {
    return customLabel
  }

  const label = BENCHMARK_LABELS[key]
  if (label) {
    return language === 'pl' ? label.pl : label.en
  }

  if (key.startsWith('CUSTOM_')) {
    const index = Number(key.split('_')[1])
    return language === 'pl' ? `Własny benchmark ${index}` : `Custom benchmark ${index}`
  }

  return key
}
