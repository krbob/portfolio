import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'

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
}

export function PortfolioValueChart({
  points,
  valueKey,
  contributionsKey,
  unit,
}: PortfolioValueChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const valueSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const contributionsSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)

  useEffect(() => {
    if (!containerRef.current || !isInteractiveChartEnvironment()) {
      return
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#58705f',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(19, 32, 24, 0.08)' },
        horzLines: { color: 'rgba(19, 32, 24, 0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(19, 32, 24, 0.12)',
      },
      timeScale: {
        borderColor: 'rgba(19, 32, 24, 0.12)',
      },
      width: containerRef.current.clientWidth,
      height: 320,
    })

    const valueSeries = chart.addSeries(AreaSeries, {
      lineColor: '#132018',
      topColor: 'rgba(19, 32, 24, 0.24)',
      bottomColor: 'rgba(19, 32, 24, 0.04)',
      lineWidth: 2,
      priceFormat: priceFormatForUnit(unit),
    })
    const contributionsSeries = chart.addSeries(LineSeries, {
      color: '#8a6b3f',
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
  }, [unit])

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
          <strong>Portfolio value</strong>
          <p className="muted-copy">Current value versus cumulative contributions in {unit}.</p>
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

function isInteractiveChartEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  return !window.navigator.userAgent.toLowerCase().includes('jsdom')
}
