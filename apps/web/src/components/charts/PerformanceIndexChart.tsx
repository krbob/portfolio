import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { LineSeries, type IChartApi, type ISeriesApi, LineStyle } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { formatDate, formatNumber } from '../../lib/format'
import { t } from '../../lib/messages'
import { ChartContainer } from './ChartContainer'
import { ChartDataTable } from './ChartDataTable'

export interface PerformanceIndexSeriesConfig {
  id: string
  label?: string
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyle
  getValue: (point: PortfolioDailyHistoryPoint) => string | null | undefined
}

interface PerformanceIndexChartProps {
  points: PortfolioDailyHistoryPoint[]
  series: PerformanceIndexSeriesConfig[]
  height?: number
  title?: string
  subtitle?: string
  legend?: ReactNode
}

const performanceIndexPriceFormat = { type: 'price' as const, minMove: 0.01, precision: 2 }

export function PerformanceIndexChart({
  points,
  series,
  height = 300,
  title,
  subtitle,
  legend,
}: PerformanceIndexChartProps) {
  const chartRef = useRef<IChartApi | null>(null)
  const hasMountedRef = useRef(false)
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const stateRef = useRef({ points, series })
  stateRef.current = { points, series }
  const accessibleRows = useMemo(() => {
    const valuesBySeries = series.map((config) => new Map(
      seriesDataFor(points, config).map((item) => [String(item.time), item.value]),
    ))

    return points.map((point) => ({
      key: point.date,
      cells: [
        formatDate(point.date),
        ...valuesBySeries.map((values) => formatNumber(values.get(point.date), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })),
      ],
    }))
  }, [points, series])

  const updateSeriesData = useCallback(() => {
    const { points: currentPoints, series: currentSeries } = stateRef.current
    const desiredIds = currentSeries.map((item) => item.id)
    const currentChart = chartRef.current
    const currentSeriesMap = seriesRef.current

    currentSeriesMap.forEach((chartSeries, id) => {
      if (!desiredIds.includes(id)) {
        currentChart?.removeSeries(chartSeries)
        currentSeriesMap.delete(id)
      }
    })

    for (const config of currentSeries) {
      let chartSeries = currentSeriesMap.get(config.id)
      if (!chartSeries && currentChart) {
        chartSeries = currentChart.addSeries(LineSeries, {
          color: config.color,
          lineWidth: config.lineWidth ?? 2,
          lineStyle: config.lineStyle ?? LineStyle.Solid,
          priceFormat: performanceIndexPriceFormat,
        })
        currentSeriesMap.set(config.id, chartSeries)
      }

      chartSeries?.applyOptions({
        color: config.color,
        lineWidth: config.lineWidth ?? 2,
        lineStyle: config.lineStyle ?? LineStyle.Solid,
      })
      chartSeries?.setData(seriesDataFor(currentPoints, config))
    }

    currentChart?.timeScale().fitContent()
  }, [])

  const onChartReady = useCallback((chart: IChartApi) => {
    chartRef.current = chart
    seriesRef.current = new Map()

    updateSeriesData()

    return () => {
      chartRef.current = null
      seriesRef.current = new Map()
    }
  }, [updateSeriesData])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    updateSeriesData()
  }, [points, series, updateSeriesData])

  return (
    <ChartContainer
      height={height}
      title={title}
      subtitle={subtitle}
      legend={legend}
      dataTable={
        <ChartDataTable
          caption={title ?? t('chart.data')}
          columns={[t('chart.date'), ...series.map((config) => config.label ?? config.id)]}
          rows={accessibleRows}
        />
      }
      onChartReady={onChartReady}
    />
  )
}

function seriesDataFor(points: PortfolioDailyHistoryPoint[], config: PerformanceIndexSeriesConfig) {
  const rawData = points.flatMap((point) => {
    const value = config.getValue(point)
    if (value == null) {
      return []
    }

    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return []
    }

    return [{ time: point.date, value: numericValue }]
  })

  const baseValue = rawData.find((item) => item.value > 0)?.value
  if (baseValue == null) {
    return rawData
  }

  return rawData.map((item) => ({
    ...item,
    value: (item.value / baseValue) * 100,
  }))
}
