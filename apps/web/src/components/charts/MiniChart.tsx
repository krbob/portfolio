import { useCallback } from 'react'
import { AreaSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { ChartContainer } from './ChartContainer'

interface MiniChartProps {
  points: PortfolioDailyHistoryPoint[]
  valueKey?: 'totalCurrentValuePln' | 'totalCurrentValueUsd' | 'totalCurrentValueAu'
  color?: string
  fillColor?: string
  fadeColor?: string
  height?: number
}

export function MiniChart({
  points,
  valueKey = 'totalCurrentValuePln',
  color = chartPalette.portfolio,
  fillColor = chartPalette.portfolioFill,
  fadeColor = chartPalette.portfolioFade,
  height = 200,
}: MiniChartProps) {
  const onChart = useCallback(
    (chart: IChartApi) => {
      chart.applyOptions({
        rightPriceScale: { visible: false },
        timeScale: { visible: false },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        crosshair: {
          vertLine: { visible: false },
          horzLine: { visible: false },
        },
        handleScroll: false,
        handleScale: false,
      })

      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: fillColor,
        bottomColor: fadeColor,
        lineWidth: 2,
        crosshairMarkerVisible: false,
      })

      series.setData(
        points
          .filter((p) => p[valueKey] != null)
          .map((p) => ({ time: p.date, value: Number(p[valueKey]) })),
      )
      chart.timeScale().fitContent()
    },
    [points, valueKey, color, fillColor, fadeColor],
  )

  return <ChartContainer height={height} onChart={onChart} />
}
