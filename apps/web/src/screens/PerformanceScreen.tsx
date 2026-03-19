import { useMemo, useState } from 'react'
import type { PortfolioDailyHistoryPoint, BenchmarkComparison, PortfolioReturnPeriod } from '../api/read-model'
import { PortfolioValueChart, AllocationTimeChart, BenchmarkChart } from '../components/charts'
import { PageHeader } from '../components/layout'
import { EmptyState, ErrorState, LoadingState, StatCard, StatePanel, TabBar, SegmentedControl } from '../components/ui'
import { usePortfolioDailyHistory, usePortfolioReturns } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent, formatYearMonth } from '../lib/format'
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
  const allPeriods = returnsQuery.data?.periods ?? []
  const filteredPoints = useMemo(() => filterByPeriod(allPoints, period), [allPoints, period])
  const latest = filteredPoints.at(-1) ?? allPoints.at(-1)

  const series = seriesForUnit(unit)

  // Featured returns for stat cards
  const ytdPeriod = findReturnPeriod(allPeriods, 'YTD')
  const y1Period = findReturnPeriod(allPeriods, 'ONE_YEAR')
  const inceptionPeriod = findReturnPeriod(allPeriods, 'MAX')
  const hasHistory = allPoints.length > 0
  const hasReturns = allPeriods.length > 0

  function handleRetry() {
    void Promise.all([historyQuery.refetch(), returnsQuery.refetch()])
  }

  if (historyQuery.isLoading && returnsQuery.isLoading && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title="Performance" />
        <LoadingState
          title="Loading performance"
          description="Preparing history, returns and benchmark comparisons for the portfolio."
          blocks={4}
        />
      </>
    )
  }

  if (historyQuery.isError && returnsQuery.isError && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title="Performance" />
        <ErrorState
          title="Performance unavailable"
          description="History and return read models could not load. Retry now or inspect storage and market-data readiness."
          onRetry={handleRetry}
        />
      </>
    )
  }

  if (!historyQuery.isLoading && !returnsQuery.isLoading && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title="Performance" />
        <EmptyState
          title="No performance data yet"
          description="Record transactions first so Portfolio can reconstruct daily history, returns and benchmarks."
          action={{ label: 'Open Transactions', to: '/transactions' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Performance" />

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
      <TabBar tabs={TABS} value={tab} onChange={setTab} ariaLabel="Performance workspace" idBase="performance-workspace" />

      <div className="mt-6">
        {tab === 'charts' ? (
          <section
            role="tabpanel"
            id="performance-workspace-panel-charts"
            aria-labelledby="performance-workspace-tab-charts"
          >
            <ChartsTab
              historyQuery={historyQuery}
              points={filteredPoints}
              period={period}
              onPeriodChange={setPeriod}
              unit={unit}
              onUnitChange={setUnit}
              series={series}
            />
          </section>
        ) : (
          <section
            role="tabpanel"
            id="performance-workspace-panel-returns"
            aria-labelledby="performance-workspace-tab-returns"
          >
            <ReturnsTab returnsQuery={returnsQuery} />
          </section>
        )}
      </div>
    </>
  )
}

// --- Charts Tab ---

function ChartsTab({
  historyQuery,
  points,
  period,
  onPeriodChange,
  unit,
  onUnitChange,
  series,
}: {
  historyQuery: ReturnType<typeof usePortfolioDailyHistory>
  points: PortfolioDailyHistoryPoint[]
  period: Period
  onPeriodChange: (period: Period) => void
  unit: Unit
  onUnitChange: (u: Unit) => void
  series: ReturnType<typeof seriesForUnit>
}) {
  if (historyQuery.isLoading && points.length === 0) {
    return (
      <LoadingState
        title="Loading portfolio history"
        description="Preparing value, contributions and allocation history for the selected period."
      />
    )
  }

  if (historyQuery.isError && points.length === 0) {
    return (
      <ErrorState
        title="History unavailable"
        description="Daily history could not load for the performance workspace."
        onRetry={() => void historyQuery.refetch()}
      />
    )
  }

  if (points.length === 0) {
    return (
      <StatePanel
        eyebrow="History"
        title="No history data available"
        description="Portfolio has not accumulated enough transactions to render the historical charts yet."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Portfolio Value Chart */}
      <div className={card}>
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-400">Range</span>
            <SegmentedControl
              options={PERIODS.map((value) => ({ value, label: value }))}
              value={period}
              onChange={(value) => onPeriodChange(value as Period)}
              ariaLabel="Performance chart period"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-400">Unit</span>
            <SegmentedControl
              options={[
                { value: 'PLN', label: 'PLN' },
                { value: 'USD', label: 'USD' },
                { value: 'AU', label: 'Gold' },
              ]}
              value={unit}
              onChange={(value) => onUnitChange(value as Unit)}
              ariaLabel="Performance chart unit"
            />
          </div>
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

function ReturnsTab({ returnsQuery }: { returnsQuery: ReturnType<typeof usePortfolioReturns> }) {
  const data = returnsQuery.data

  if (returnsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading returns"
        description="Calculating money-weighted, time-weighted and benchmark-relative returns."
      />
    )
  }

  if (returnsQuery.isError) {
    return (
      <ErrorState
        title="Returns unavailable"
        description="Return calculations could not be loaded for this workspace."
        onRetry={() => void returnsQuery.refetch()}
      />
    )
  }

  if (!data || data.periods.length === 0) {
    return (
      <StatePanel
        eyebrow="Returns"
        title="No return periods calculated yet"
        description="Return periods appear after Portfolio has enough history and external cash-flow data to evaluate."
      />
    )
  }

  const realCoverageUntil = findRealPlnCoverageMonth(data.periods)

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
                className={`${tr} ${p.key === 'MAX' ? 'bg-zinc-800/20' : ''}`}
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
      {realCoverageUntil ? (
        <p className="text-xs text-zinc-500">
          Real PLN uses CPI-covered full months only; current CPI coverage through {realCoverageUntil}.
        </p>
      ) : null}

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

function findReturnPeriod(
  periods: PortfolioReturnPeriod[],
  key: PortfolioReturnPeriod['key'],
) {
  return periods.find((period) => period.key === key)
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

function findRealPlnCoverageMonth(periods: PortfolioReturnPeriod[]) {
  const exclusiveCoverageMonth = periods
    .map((period) => period.inflationUntil)
    .find((value): value is string => Boolean(value))

  if (!exclusiveCoverageMonth) {
    return null
  }

  const match = /^(\d{4})-(\d{2})$/.exec(exclusiveCoverageMonth)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return null
  }

  const coverageDate = new Date(Date.UTC(year, month - 2, 1))
  return formatYearMonth(`${coverageDate.getUTCFullYear()}-${String(coverageDate.getUTCMonth() + 1).padStart(2, '0')}`)
}
