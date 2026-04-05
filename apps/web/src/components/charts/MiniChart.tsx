import { useCallback, useEffect, useRef } from 'react'
import { AreaSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { ChartContainer } from './ChartContainer'

export interface MiniChartHoverInfo {
  value: number
  date: string
}

interface MiniChartProps {
  points: PortfolioDailyHistoryPoint[]
  valueKey?: 'totalCurrentValuePln' | 'totalCurrentValueUsd' | 'totalCurrentValueAu'
  color?: string
  fillColor?: string
  fadeColor?: string
  height?: number
  onHover?: (info: MiniChartHoverInfo | null) => void
}

export function MiniChart({
  points,
  valueKey = 'totalCurrentValuePln',
  color = chartPalette.portfolio,
  fillColor = chartPalette.portfolioFill,
  fadeColor = chartPalette.portfolioFade,
  height = 200,
  onHover,
}: MiniChartProps) {
  const chartRef = useRef<IChartApi | null>(null)
  const hasMountedRef = useRef(false)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover

  const stateRef = useRef({
    points,
    valueKey,
    color,
    fillColor,
    fadeColor,
  })
  stateRef.current = {
    points,
    valueKey,
    color,
    fillColor,
    fadeColor,
  }

  const applySeriesOptions = useCallback(() => {
    const { color, fillColor, fadeColor } = stateRef.current
    seriesRef.current?.applyOptions({
      lineColor: color,
      topColor: fillColor,
      bottomColor: fadeColor,
    })
  }, [])

  const updateSeriesData = useCallback(() => {
    const { points: currentPoints, valueKey: currentValueKey } = stateRef.current
    seriesRef.current?.setData(
      currentPoints
        .filter((point) => point[currentValueKey] != null)
        .map((point) => ({ time: point.date, value: Number(point[currentValueKey]) })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [])

  const onChartReady = useCallback((chart: IChartApi) => {
    chartRef.current = chart
    chart.applyOptions({
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: {
        vertLine: { visible: true, color: chartPalette.crosshair, style: 3, labelVisible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    })

    seriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: stateRef.current.color,
      topColor: stateRef.current.fillColor,
      bottomColor: stateRef.current.fadeColor,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    })

    chart.subscribeCrosshairMove((param) => {
      if (!onHoverRef.current) return
      if (!param.time || !param.seriesData?.size) {
        onHoverRef.current(null)
        return
      }
      const data = param.seriesData.get(seriesRef.current!)
      if (data && 'value' in data && typeof data.value === 'number') {
        onHoverRef.current({ value: data.value, date: String(param.time) })
      } else {
        onHoverRef.current(null)
      }
    })

    updateSeriesData()

    return () => {
      chartRef.current = null
      seriesRef.current = null
    }
  }, [updateSeriesData])

  useEffect(() => {
    applySeriesOptions()
  }, [applySeriesOptions, color, fillColor, fadeColor])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    updateSeriesData()
  }, [points, updateSeriesData, valueKey])

  return <ChartContainer height={height} onChartReady={onChartReady} />
}
