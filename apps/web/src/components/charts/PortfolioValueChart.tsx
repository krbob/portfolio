import { useCallback, useEffect, useRef } from 'react'
import { AreaSeries, LineSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { formatMessage, t } from '../../lib/messages'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

interface PortfolioValueChartProps {
  points: PortfolioDailyHistoryPoint[]
  valueKey: 'totalCurrentValuePln' | 'totalCurrentValueUsd' | 'totalCurrentValueAu'
  contributionsKey: 'netContributionsPln' | 'netContributionsUsd' | 'netContributionsAu'
  unit: 'PLN' | 'USD' | 'AU'
  height?: number
  title?: string
}

export function PortfolioValueChart({
  points,
  valueKey,
  contributionsKey,
  unit,
  height = 320,
  title = 'Portfolio Value',
}: PortfolioValueChartProps) {
  const chartRef = useRef<IChartApi | null>(null)
  const hasMountedRef = useRef(false)
  const valueSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const contributionsSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const stateRef = useRef({
    points,
    valueKey,
    contributionsKey,
    unit,
  })
  stateRef.current = {
    points,
    valueKey,
    contributionsKey,
    unit,
  }

  const applySeriesOptions = useCallback(() => {
    const priceFormat = priceFormatForUnit(stateRef.current.unit)
    valueSeriesRef.current?.applyOptions({ priceFormat })
    contributionsSeriesRef.current?.applyOptions({ priceFormat })
  }, [])

  const updateSeriesData = useCallback(() => {
    const { points: currentPoints, valueKey: currentValueKey, contributionsKey: currentContributionsKey } = stateRef.current
    valueSeriesRef.current?.setData(
      currentPoints
        .filter((point) => point[currentValueKey] != null)
        .map((point) => ({ time: point.date, value: Number(point[currentValueKey]) })),
    )
    contributionsSeriesRef.current?.setData(
      currentPoints
        .filter((point) => point[currentContributionsKey] != null)
        .map((point) => ({ time: point.date, value: Number(point[currentContributionsKey]) })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [])

  const onChartReady = useCallback((chart: IChartApi) => {
    chartRef.current = chart
    valueSeriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: chartPalette.portfolio,
      topColor: chartPalette.portfolioFill,
      bottomColor: chartPalette.portfolioFade,
      lineWidth: 2,
      priceFormat: priceFormatForUnit(stateRef.current.unit),
    })
    contributionsSeriesRef.current = chart.addSeries(LineSeries, {
      color: chartPalette.contributions,
      lineWidth: 2,
      lineStyle: 2,
      priceFormat: priceFormatForUnit(stateRef.current.unit),
    })

    updateSeriesData()

    return () => {
      chartRef.current = null
      valueSeriesRef.current = null
      contributionsSeriesRef.current = null
    }
  }, [updateSeriesData])

  useEffect(() => {
    applySeriesOptions()
  }, [applySeriesOptions, unit])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    updateSeriesData()
  }, [contributionsKey, points, updateSeriesData, valueKey])

  return (
    <ChartContainer
      height={height}
      title={title === 'Portfolio Value' ? t('portfolioValue.title') : title}
      subtitle={formatMessage(t('portfolioValue.subtitle'), { unit })}
      legend={
        <>
          <ChartLegendItem color={chartPalette.portfolio} label={formatMessage(t('portfolioValue.valueLegend'), { unit })} />
          <ChartLegendItem color={chartPalette.contributions} label={t('portfolioValue.contributions')} dashed />
        </>
      }
      onChartReady={onChartReady}
    />
  )
}

function priceFormatForUnit(unit: 'PLN' | 'USD' | 'AU') {
  if (unit === 'AU') {
    return { type: 'price' as const, minMove: 0.000001, precision: 6 }
  }
  return { type: 'price' as const, minMove: 0.01, precision: 2 }
}
