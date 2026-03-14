import { useEffect, useRef } from 'react'
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'

interface PortfolioBenchmarkChartProps {
  points: PortfolioDailyHistoryPoint[]
}

export function PortfolioBenchmarkChart({ points }: PortfolioBenchmarkChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const portfolioSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const vwraSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const inflationSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const targetMixSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)

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
      height: 300,
    })

    portfolioSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#132018',
      lineWidth: 3,
      priceFormat: benchmarkPriceFormat,
    })
    vwraSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#1d6a39',
      lineWidth: 2,
      priceFormat: benchmarkPriceFormat,
    })
    inflationSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#8a6b3f',
      lineWidth: 2,
      lineStyle: 2,
      priceFormat: benchmarkPriceFormat,
    })
    targetMixSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#c07b1d',
      lineWidth: 2,
      lineStyle: 1,
      priceFormat: benchmarkPriceFormat,
    })
    chartRef.current = chart

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
      portfolioSeriesRef.current = null
      vwraSeriesRef.current = null
      inflationSeriesRef.current = null
      targetMixSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    portfolioSeriesRef.current?.setData(
      toLineData(points, 'portfolioPerformanceIndex'),
    )
    vwraSeriesRef.current?.setData(
      toLineData(points, 'equityBenchmarkIndex'),
    )
    inflationSeriesRef.current?.setData(
      toLineData(points, 'inflationBenchmarkIndex'),
    )
    targetMixSeriesRef.current?.setData(
      toLineData(points, 'targetMixBenchmarkIndex'),
    )
    chartRef.current?.timeScale().fitContent()
  }, [points])

  return (
    <>
      <div className="chart-header">
        <div>
          <strong>Benchmark comparison</strong>
          <p className="muted-copy">Indexed to 100 at the start of the selected period.</p>
        </div>
        <div className="chart-inline-legend">
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-primary" />
            Portfolio
          </span>
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-equity" />
            VWRA
          </span>
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-cash" />
            Inflation
          </span>
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-bond" />
            Target mix
          </span>
        </div>
      </div>
      <div ref={containerRef} className="lightweight-chart" />
    </>
  )
}

function toLineData(
  points: PortfolioDailyHistoryPoint[],
  key:
    | 'portfolioPerformanceIndex'
    | 'equityBenchmarkIndex'
    | 'inflationBenchmarkIndex'
    | 'targetMixBenchmarkIndex',
) {
  return points
    .filter((point) => point[key] != null)
    .map((point) => ({
      time: point.date,
      value: Number(point[key]),
    }))
}

const benchmarkPriceFormat = {
  type: 'price' as const,
  minMove: 0.01,
  precision: 2,
}

function isInteractiveChartEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  return !window.navigator.userAgent.toLowerCase().includes('jsdom')
}
