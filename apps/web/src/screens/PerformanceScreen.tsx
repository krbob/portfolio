import { useMemo, useState } from 'react'
import type { PortfolioDailyHistoryPoint, BenchmarkComparison } from '../api/read-model'
import { PortfolioValueChart, AllocationTimeChart, BenchmarkChart } from '../components/charts'
import { PageHeader } from '../components/layout'
import { StatCard, TabBar, SegmentedControl } from '../components/ui'
import { usePortfolioDailyHistory, usePortfolioReturns } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent } from '../lib/format'
import { card, th, thRight, td, tdRight, tr } from '../lib/styles'

type Period = 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX'
type Unit = 'PLN' | 'USD' | 'AU'
type Tab = 'charts' | 'returns'

const PERIODS: Period[] = ['YTD', '1Y', '3Y', '5Y', 'MAX']
const TABS = [
  { value: 'charts' as const, label: 'Charts' },
  { value: 'returns' as const, label: 'Returns' },
]

export function PerformanceScreen() {
  const [tab, setTab] = useState<Tab>('charts')
  const [period, setPeriod] = useState<Period>('MAX')
  const [unit, setUnit] = useState<Unit>('PLN')

  const historyQuery = usePortfolioDailyHistory()
  const returnsQuery = usePortfolioReturns()

  const allPoints = historyQuery.data?.points ?? []
  const filteredPoints = useMemo(() => filterByPeriod(allPoints, period), [allPoints, period])
  const latest = filteredPoints.at(-1) ?? allPoints.at(-1)

  const series = seriesForUnit(unit)

  // Featured returns for stat cards
  const ytdPeriod = returnsQuery.data?.periods.find((p) => p.key === 'YTD')
  const y1Period = returnsQuery.data?.periods.find((p) => p.key === '1Y')
  const inceptionPeriod = returnsQuery.data?.periods.find((p) => p.key === 'INCEPTION')

  return (
    <>
      <PageHeader title="Performance">
        <SegmentedControl
          options={PERIODS.map((p) => ({ value: p, label: p }))}
          value={period}
          onChange={(v) => setPeriod(v as Period)}
        />
      </PageHeader>

      {/* Top stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Latest Value"
          value={latest ? formatCurrencyPln(latest.totalCurrentValuePln) : 'N/A'}
        />
        <StatCard
          label="YTD MWRR"
          value={formatReturn(ytdPeriod?.nominalPln?.moneyWeightedReturn)}
          change={returnChange(ytdPeriod?.nominalPln?.moneyWeightedReturn)}
        />
        <StatCard
          label="1Y MWRR"
          value={formatReturn(y1Period?.nominalPln?.moneyWeightedReturn)}
          change={returnChange(y1Period?.nominalPln?.moneyWeightedReturn)}
        />
        <StatCard
          label="Inception MWRR"
          value={formatReturn(inceptionPeriod?.nominalPln?.moneyWeightedReturn)}
          change={returnChange(inceptionPeriod?.nominalPln?.moneyWeightedReturn)}
        />
      </div>

      {/* Tab bar */}
      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === 'charts' ? (
          <ChartsTab
            points={filteredPoints}
            unit={unit}
            onUnitChange={setUnit}
            series={series}
          />
        ) : (
          <ReturnsTab />
        )}
      </div>
    </>
  )
}

// --- Charts Tab ---

function ChartsTab({
  points,
  unit,
  onUnitChange,
  series,
}: {
  points: PortfolioDailyHistoryPoint[]
  unit: Unit
  onUnitChange: (u: Unit) => void
  series: ReturnType<typeof seriesForUnit>
}) {
  if (points.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500">No history data available.</p>
  }

  return (
    <div className="space-y-4">
      {/* Portfolio Value Chart */}
      <div className={card}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">Unit</span>
          <SegmentedControl
            options={[
              { value: 'PLN', label: 'PLN' },
              { value: 'USD', label: 'USD' },
              { value: 'AU', label: 'Gold' },
            ]}
            value={unit}
            onChange={(v) => onUnitChange(v as Unit)}
          />
        </div>
        <PortfolioValueChart
          points={points}
          valueKey={series.valueKey}
          contributionsKey={series.contributionsKey}
          unit={unit}
          height={360}
          title={`Portfolio Value (${unit})`}
        />
      </div>

      {/* Allocation Over Time */}
      <div className={card}>
        <AllocationTimeChart points={points} />
      </div>

      {/* Benchmark Comparison */}
      <div className={card}>
        <BenchmarkChart points={points} />
      </div>
    </div>
  )
}

// --- Returns Tab ---

function ReturnsTab() {
  const returnsQuery = usePortfolioReturns()
  const data = returnsQuery.data

  if (returnsQuery.isLoading) {
    return <div className={`${card} h-48 animate-pulse`} />
  }

  if (returnsQuery.isError) {
    return <p className="text-sm text-red-400">{returnsQuery.error.message}</p>
  }

  if (!data || data.periods.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500">No return periods calculated yet.</p>
  }

  return (
    <div className="space-y-4">
      {/* Returns table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className={th}>Period</th>
              <th className={thRight}>PLN MWRR</th>
              <th className={thRight}>PLN TWR</th>
              <th className={thRight}>Real PLN</th>
              <th className={thRight}>USD MWRR</th>
              <th className={thRight}>Annualized</th>
              <th className={thRight}>Days</th>
            </tr>
          </thead>
          <tbody>
            {data.periods.map((p) => (
              <tr
                key={p.key}
                className={`${tr} ${p.key === 'INCEPTION' ? 'bg-zinc-800/20' : ''}`}
              >
                <td className={`${td} font-medium text-zinc-200`}>
                  {p.label}
                  {p.clippedToInception && (
                    <span className="ml-1.5 text-xs text-zinc-600">(clipped)</span>
                  )}
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalPln?.moneyWeightedReturn} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalPln?.timeWeightedReturn} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.realPln?.moneyWeightedReturn} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalUsd?.moneyWeightedReturn} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalPln?.annualizedMoneyWeightedReturn} />
                </td>
                <td className={`${tdRight} text-zinc-500`}>{p.dayCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Benchmark comparisons per period */}
      {data.periods
        .filter((p) => p.benchmarks.length > 0)
        .map((p) => (
          <div key={p.key} className={card}>
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              {p.label} — Benchmarks
            </h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {p.benchmarks.map((b) => (
                <BenchmarkCard key={b.key} benchmark={b} />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

function BenchmarkCard({ benchmark }: { benchmark: BenchmarkComparison }) {
  return (
    <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 p-3">
      <p className="text-xs font-medium text-zinc-500">{benchmark.label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${returnColor(benchmark.excessTimeWeightedReturn)}`}>
        {formatReturn(benchmark.excessTimeWeightedReturn)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Bench TWR {formatReturn(benchmark.nominalPln?.timeWeightedReturn)}
      </p>
    </div>
  )
}

function ReturnValue({ value }: { value: string | null | undefined }) {
  return (
    <span className={`font-medium ${returnColor(value)}`}>
      {formatReturn(value)}
    </span>
  )
}

// --- Utilities ---

function filterByPeriod(points: PortfolioDailyHistoryPoint[], period: Period) {
  if (period === 'MAX' || points.length === 0) return points
  const latest = new Date(points.at(-1)!.date)
  if (period === 'YTD') {
    const cutoff = `${latest.getUTCFullYear()}-01-01`
    return points.filter((p) => p.date >= cutoff)
  }
  const months = period === '1Y' ? 12 : period === '3Y' ? 36 : 60
  const cutoff = new Date(latest)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffStr)
}

function seriesForUnit(unit: Unit) {
  switch (unit) {
    case 'USD': return { valueKey: 'totalCurrentValueUsd' as const, contributionsKey: 'netContributionsUsd' as const }
    case 'AU': return { valueKey: 'totalCurrentValueAu' as const, contributionsKey: 'netContributionsAu' as const }
    default: return { valueKey: 'totalCurrentValuePln' as const, contributionsKey: 'netContributionsPln' as const }
  }
}

function formatReturn(value: string | null | undefined) {
  return formatPercent(value, { scale: 100, signed: true })
}

function returnChange(value: string | null | undefined): 'positive' | 'negative' | 'neutral' | undefined {
  if (value == null) return undefined
  const n = Number(value)
  if (n > 0) return 'positive'
  if (n < 0) return 'negative'
  return 'neutral'
}

function returnColor(value: string | null | undefined) {
  if (value == null) return 'text-zinc-500'
  const n = Number(value)
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-red-400'
  return 'text-zinc-400'
}
