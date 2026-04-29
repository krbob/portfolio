import { useMemo } from 'react'
import { LineStyle } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { t } from '../../lib/messages'
import { ChartLegendItem } from './ChartContainer'
import { PerformanceIndexChart, type PerformanceIndexSeriesConfig } from './PerformanceIndexChart'

interface PortfolioPerformanceChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
}

export function PortfolioPerformanceChart({ points, height = 320 }: PortfolioPerformanceChartProps) {
  const series = useMemo<PerformanceIndexSeriesConfig[]>(
    () => [
      {
        id: 'portfolio-performance',
        color: chartPalette.performance,
        lineWidth: 3,
        lineStyle: LineStyle.Solid,
        getValue: (point) => point.portfolioPerformanceIndex,
      },
    ],
    [],
  )

  return (
    <PerformanceIndexChart
      points={points}
      series={series}
      height={height}
      title={t('portfolioPerformance.title')}
      subtitle={t('portfolioPerformance.subtitle')}
      legend={<ChartLegendItem color={chartPalette.performance} label={t('portfolioPerformance.legend')} />}
    />
  )
}
