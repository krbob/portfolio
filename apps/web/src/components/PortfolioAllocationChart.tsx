import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { chartPalette, createPortfolioChartOptions, isInteractiveChartEnvironment } from '../lib/chart-theme'

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

    const chart = createChart(
      containerRef.current,
      createPortfolioChartOptions(containerRef.current.clientWidth, 280),
    )

    const equitySeries = chart.addSeries(AreaSeries, {
      lineColor: chartPalette.equities,
      topColor: chartPalette.positiveFill,
      bottomColor: chartPalette.positiveFade,
      lineWidth: 2,
    })
    const bondSeries = chart.addSeries(AreaSeries, {
      lineColor: chartPalette.bonds,
      topColor: chartPalette.amberFill,
      bottomColor: chartPalette.amberFade,
      lineWidth: 2,
    })
    const cashSeries = chart.addSeries(AreaSeries, {
      lineColor: chartPalette.cash,
      topColor: chartPalette.cyanFill,
      bottomColor: chartPalette.cyanFade,
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
