import { useCallback } from 'react'
import { AreaSeries, LineSeries, type IChartApi } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
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
  const onChart = useCallback(
    (chart: IChartApi) => {
      const valueSeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.portfolio,
        topColor: chartPalette.portfolioFill,
        bottomColor: chartPalette.portfolioFade,
        lineWidth: 2,
        priceFormat: priceFormatForUnit(unit),
      })
      const contributionsSeries = chart.addSeries(LineSeries, {
        color: chartPalette.contributions,
        lineWidth: 2,
        lineStyle: 2,
        priceFormat: priceFormatForUnit(unit),
      })

      valueSeries.setData(
        points
          .filter((p) => p[valueKey] != null)
          .map((p) => ({ time: p.date, value: Number(p[valueKey]) })),
      )
      contributionsSeries.setData(
        points
          .filter((p) => p[contributionsKey] != null)
          .map((p) => ({ time: p.date, value: Number(p[contributionsKey]) })),
      )
      chart.timeScale().fitContent()
    },
    [points, valueKey, contributionsKey, unit],
  )

  return (
    <ChartContainer
      height={height}
      title={title}
      subtitle={`Value vs contributions in ${unit}`}
      legend={
        <>
          <ChartLegendItem color={chartPalette.portfolio} label={`Value (${unit})`} />
          <ChartLegendItem color={chartPalette.contributions} label="Contributions" dashed />
        </>
      }
      onChart={onChart}
    />
  )
}

function priceFormatForUnit(unit: 'PLN' | 'USD' | 'AU') {
  if (unit === 'AU') {
    return { type: 'price' as const, minMove: 0.000001, precision: 6 }
  }
  return { type: 'price' as const, minMove: 0.01, precision: 2 }
}
