import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'

interface PortfolioAllocationChartProps {
  points: PortfolioDailyHistoryPoint[]
}

export function PortfolioAllocationChart({ points }: PortfolioAllocationChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const equitySeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const bondSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const cashSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)

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
      height: 280,
    })

    const equitySeries = chart.addSeries(AreaSeries, {
      lineColor: '#1d6a39',
      topColor: 'rgba(29, 106, 57, 0.28)',
      bottomColor: 'rgba(29, 106, 57, 0.04)',
      lineWidth: 2,
    })
    const bondSeries = chart.addSeries(AreaSeries, {
      lineColor: '#c07b1d',
      topColor: 'rgba(192, 123, 29, 0.24)',
      bottomColor: 'rgba(192, 123, 29, 0.04)',
      lineWidth: 2,
    })
    const cashSeries = chart.addSeries(AreaSeries, {
      lineColor: '#8a6b3f',
      topColor: 'rgba(138, 107, 63, 0.18)',
      bottomColor: 'rgba(138, 107, 63, 0.03)',
      lineWidth: 2,
    })

    chartRef.current = chart
    equitySeriesRef.current = equitySeries
    bondSeriesRef.current = bondSeries
    cashSeriesRef.current = cashSeries

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
      equitySeriesRef.current = null
      bondSeriesRef.current = null
      cashSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!equitySeriesRef.current || !bondSeriesRef.current || !cashSeriesRef.current) {
      return
    }

    equitySeriesRef.current.setData(
      points.map((point) => ({
        time: point.date,
        value: Number(point.equityAllocationPct),
      })),
    )
    bondSeriesRef.current.setData(
      points.map((point) => ({
        time: point.date,
        value: Number(point.bondAllocationPct),
      })),
    )
    cashSeriesRef.current.setData(
      points.map((point) => ({
        time: point.date,
        value: Number(point.cashAllocationPct),
      })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [points])

  return (
    <>
      <div className="chart-header">
        <div>
          <strong>Allocation history</strong>
          <p className="muted-copy">Equities, bonds and cash as a percentage of portfolio value.</p>
        </div>
        <div className="chart-inline-legend">
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-equity" />
            Equities
          </span>
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-bond" />
            Bonds
          </span>
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-cash" />
            Cash
          </span>
        </div>
      </div>
      <div ref={containerRef} className="lightweight-chart" />
    </>
  )
}

function isInteractiveChartEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  return !window.navigator.userAgent.toLowerCase().includes('jsdom')
}
