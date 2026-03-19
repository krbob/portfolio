import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { chartPalette, createPortfolioChartOptions, isInteractiveChartEnvironment } from '../lib/chart-theme'

interface PortfolioValueChartProps {
  points: PortfolioDailyHistoryPoint[]
  valueKey:
    | 'totalCurrentValuePln'
    | 'totalCurrentValueUsd'
    | 'totalCurrentValueAu'
  contributionsKey:
    | 'netContributionsPln'
    | 'netContributionsUsd'
    | 'netContributionsAu'
  unit: 'PLN' | 'USD' | 'AU'
  height?: number
  title?: string
  description?: string
}

export function PortfolioValueChart({
  points,
  valueKey,
  contributionsKey,
  unit,
  height = 320,
  title = 'Portfolio value',
  description = 'Current value versus cumulative contributions in',
}: PortfolioValueChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const valueSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const contributionsSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)

  useEffect(() => {
    if (!containerRef.current || !isInteractiveChartEnvironment()) {
      return
    }

    const chart = createChart(
      containerRef.current,
      createPortfolioChartOptions(containerRef.current.clientWidth, height),
    )

    const valueSeries = chart.addSeries(AreaSeries, {
      lineColor: chartPalette.equities,
      topColor: chartPalette.positiveFill,
      bottomColor: chartPalette.positiveFade,
      lineWidth: 2,
      priceFormat: priceFormatForUnit(unit),
    })
    const contributionsSeries = chart.addSeries(LineSeries, {
      color: chartPalette.contributions,
      lineWidth: 2,
      lineStyle: 2,
      priceFormat: priceFormatForUnit(unit),
    })

    chartRef.current = chart
    valueSeriesRef.current = valueSeries
    contributionsSeriesRef.current = contributionsSeries

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      valueSeriesRef.current = null
      contributionsSeriesRef.current = null
    }
  }, [height, unit])

  useEffect(() => {
    if (!valueSeriesRef.current || !contributionsSeriesRef.current) {
      return
    }

    valueSeriesRef.current.setData(
      points
        .filter((point) => point[valueKey] != null)
        .map((point) => ({
          time: point.date,
          value: Number(point[valueKey]),
        })),
    )
    contributionsSeriesRef.current.setData(
      points
        .filter((point) => point[contributionsKey] != null)
        .map((point) => ({
          time: point.date,
          value: Number(point[contributionsKey]),
        })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [contributionsKey, points, valueKey])

  return (
    <>
      <div className="chart-header">
        <div>
          <strong>{title}</strong>
          <p className="muted-copy">
            {description} {unit}.
          </p>
        </div>
      </div>
      <div ref={containerRef} className="lightweight-chart" />
    </>
  )
}

function priceFormatForUnit(unit: 'PLN' | 'USD' | 'AU') {
  if (unit === 'AU') {
    return {
      type: 'price' as const,
      minMove: 0.000001,
      precision: 6,
    }
  }

  return {
    type: 'price' as const,
    minMove: 0.01,
    precision: 2,
  }
}
