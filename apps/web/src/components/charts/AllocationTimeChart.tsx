import { useCallback, useMemo, useState } from 'react'
import { AreaSeries, type IChartApi, type MouseEventParams, type Time } from 'lightweight-charts'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
import { chartPalette } from '../../lib/chart-theme'
import { formatDate, formatPercent } from '../../lib/format'
import { t } from '../../lib/messages'
import { ChartContainer, ChartLegendItem } from './ChartContainer'

interface AllocationTimeChartProps {
  points: PortfolioDailyHistoryPoint[]
  height?: number
}

export function AllocationTimeChart({ points, height = 280 }: AllocationTimeChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<PortfolioDailyHistoryPoint | null>(null)
  const latestPoint = points.at(-1) ?? null
  const activePoint = hoveredPoint ?? latestPoint
  const pointsByDate = useMemo(
    () => new Map(points.map((point) => [point.date, point])),
    [points],
  )
  const onChart = useCallback(
    (chart: IChartApi) => {
      const equitySeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.equities,
        topColor: chartPalette.equityFill,
        bottomColor: chartPalette.equityFade,
        lineWidth: 2,
      })
      const bondSeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.bonds,
        topColor: chartPalette.bondFill,
        bottomColor: chartPalette.bondFade,
        lineWidth: 2,
      })
      const cashSeries = chart.addSeries(AreaSeries, {
        lineColor: chartPalette.cash,
        topColor: chartPalette.cashFill,
        bottomColor: chartPalette.cashFade,
        lineWidth: 2,
      })

      equitySeries.setData(points.map((p) => ({ time: p.date, value: Number(p.equityAllocationPct) })))
      bondSeries.setData(points.map((p) => ({ time: p.date, value: Number(p.bondAllocationPct) })))
      cashSeries.setData(points.map((p) => ({ time: p.date, value: Number(p.cashAllocationPct) })))
      chart.timeScale().fitContent()

      const handleCrosshairMove = (param: MouseEventParams<Time>) => {
        const timeKey = normalizeChartTime(param.time)
        setHoveredPoint(timeKey ? pointsByDate.get(timeKey) ?? null : null)
      }

      chart.subscribeCrosshairMove(handleCrosshairMove)

      return () => {
        chart.unsubscribeCrosshairMove(handleCrosshairMove)
      }
    },
    [points, pointsByDate],
  )

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {t('allocation.title')}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {t('allocation.subtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 lg:min-w-[22rem]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-[5rem]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 whitespace-nowrap">
                {hoveredPoint ? t('allocation.selectedDate') : t('allocation.latestDate')}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100 whitespace-nowrap">
                {activePoint ? formatDate(activePoint.date) : t('common.noData')}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-right">
              <AllocationMetric
                color={chartPalette.equities}
                label={t('allocation.equities')}
                value={activePoint?.equityAllocationPct ?? null}
              />
              <AllocationMetric
                color={chartPalette.bonds}
                label={t('allocation.bonds')}
                value={activePoint?.bondAllocationPct ?? null}
              />
              <AllocationMetric
                color={chartPalette.cash}
                label={t('allocation.cash')}
                value={activePoint?.cashAllocationPct ?? null}
              />
            </div>
          </div>
        </div>
      </div>

      <ChartContainer
        height={height}
        legend={
          <>
            <ChartLegendItem color={chartPalette.equities} label={t('allocation.equities')} />
            <ChartLegendItem color={chartPalette.bonds} label={t('allocation.bonds')} />
            <ChartLegendItem color={chartPalette.cash} label={t('allocation.cash')} />
          </>
        }
        onChart={onChart}
      />
    </div>
  )
}

function AllocationMetric({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div>
      <p className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">
        {formatPercent(value, { maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}

function normalizeChartTime(time: Time | undefined): string | null {
  if (time == null) {
    return null
  }

  if (typeof time === 'string') {
    return time
  }

  if (typeof time === 'number') {
    return new Date(time * 1000).toISOString().slice(0, 10)
  }

  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
}
