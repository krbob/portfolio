import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { MiniChart } from '../components/charts'
import { PageHeader } from '../components/layout'
import { StatCard, Badge, EmptyState, ErrorState, LoadingState, StatePanel } from '../components/ui'
import { usePortfolioOverview, usePortfolioDailyHistory } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { card } from '../lib/styles'

type DashboardRange = '1Y' | 'MAX'

export function DashboardScreen() {
  const [range, setRange] = useState<DashboardRange>('1Y')
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const overview = overviewQuery.data

  const allPoints = historyQuery.data?.points ?? []
  const chartPoints = useMemo(() => filterHistoryPoints(allPoints, range), [allPoints, range])
  const latestPoint = chartPoints.at(-1) ?? allPoints.at(-1)
  const previousPoint = chartPoints.at(-2) ?? allPoints.at(-2)

  const dailyChange =
    latestPoint && previousPoint
      ? Number(latestPoint.totalCurrentValuePln) - Number(previousPoint.totalCurrentValuePln)
      : null
  const dailyChangePct =
    dailyChange != null && previousPoint && Number(previousPoint.totalCurrentValuePln) !== 0
      ? (dailyChange / Number(previousPoint.totalCurrentValuePln)) * 100
      : null

  const totalCurrentValue = overview ? Number(overview.totalCurrentValuePln) : 0
  const equityPct = overview && totalCurrentValue > 0 ? (Number(overview.equityCurrentValuePln) / totalCurrentValue) * 100 : 0
  const bondPct = overview && totalCurrentValue > 0 ? (Number(overview.bondCurrentValuePln) / totalCurrentValue) * 100 : 0
  const cashPct = overview && totalCurrentValue > 0 ? (Number(overview.cashCurrentValuePln) / totalCurrentValue) * 100 : 0

  const openIssues = overview
    ? overview.valuationIssueCount + overview.missingFxTransactions + overview.unsupportedCorrectionTransactions
    : 0

  function handleRetry() {
    void Promise.all([overviewQuery.refetch(), historyQuery.refetch()])
  }

  if (overviewQuery.isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingState
          title="Loading dashboard"
          description="Preparing the current portfolio value, allocation and latest market-backed history."
          blocks={4}
        />
      </>
    )
  }

  if (overviewQuery.isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState
          title="Dashboard unavailable"
          description="Portfolio overview could not load. Retry now or inspect system health in Settings."
          onRetry={handleRetry}
        />
      </>
    )
  }

  if (!overview) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="Welcome to Portfolio"
          description="Connect your accounts and add instruments to get started with portfolio tracking."
          action={{ label: 'Go to Settings', to: '/settings' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Dashboard">
        {latestPoint && (
          <span className="text-xs text-zinc-500">
            As of {latestPoint.date}
          </span>
        )}
      </PageHeader>

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Value"
          value={formatCurrencyPln(overview.totalCurrentValuePln)}
          subtitle={`${overview.accountCount} accounts · ${overview.activeHoldingCount} holdings`}
          hero
        />
        <StatCard
          label="Daily Change"
          value={dailyChange != null ? formatSignedCurrencyPln(dailyChange) : 'N/A'}
          subtitle={dailyChangePct != null ? formatPercent(dailyChangePct, { signed: true }) : 'Waiting for data'}
          change={dailyChange != null ? (dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'neutral') : undefined}
        />
        <StatCard
          label="Equities"
          value={formatCurrencyPln(overview.equityCurrentValuePln)}
          subtitle={`${formatPercent(equityPct)} of portfolio`}
          dot="equity"
        />
        <StatCard
          label="Bonds"
          value={formatCurrencyPln(overview.bondCurrentValuePln)}
          subtitle={`${formatPercent(bondPct)} of portfolio`}
          dot="bond"
        />
      </div>

      {/* Allocation bar */}
      <div className={`${card} mt-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-400">Allocation</h3>
          <div className="flex items-center gap-4">
            <AllocationLegend label="Equities" color="bg-blue-500" pct={equityPct} />
            <AllocationLegend label="Bonds" color="bg-amber-500" pct={bondPct} />
            <AllocationLegend label="Cash" color="bg-zinc-500" pct={cashPct} />
          </div>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
          <div className="bg-blue-500 transition-all" style={{ width: `${equityPct}%` }} />
          <div className="bg-amber-500 transition-all" style={{ width: `${bondPct}%` }} />
          <div className="bg-zinc-500 transition-all" style={{ width: `${cashPct}%` }} />
        </div>
      </div>

      {/* Chart + Health side by side */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Mini portfolio chart */}
        <div className={`${card} lg:col-span-2`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-400">Portfolio Value</h3>
            <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5">
              {(['1Y', 'MAX'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    value === range
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  onClick={() => setRange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {historyQuery.isLoading && chartPoints.length === 0 ? (
            <LoadingState
              title="Loading history"
              description="Fetching the daily portfolio curve for this dashboard range."
              className="border-0 bg-transparent px-0 py-8"
              blocks={2}
            />
          ) : historyQuery.isError && chartPoints.length === 0 ? (
            <ErrorState
              title="History unavailable"
              description="The dashboard can still show current value, but the historical chart did not load."
              onRetry={() => void historyQuery.refetch()}
              className="border-0 bg-transparent px-0 py-8"
            />
          ) : chartPoints.length === 0 ? (
            <StatePanel
              title="No history data yet"
              description="Record more transactions or open Performance later to build out the portfolio curve."
              eyebrow="History"
              className="border-0 bg-transparent px-0 py-8"
            />
          ) : (
            <Link to="/performance" className="block">
              <MiniChart points={chartPoints} height={200} />
            </Link>
          )}
        </div>

        {/* Health / Issues */}
        {openIssues > 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-amber-400">Issues</h3>
              <Badge variant="warning">{openIssues}</Badge>
            </div>
            <div className="space-y-3">
              <IssueRow label="Valuation gaps" count={overview.valuationIssueCount} />
              <IssueRow label="Missing FX" count={overview.missingFxTransactions} />
              <IssueRow label="Unsupported corrections" count={overview.unsupportedCorrectionTransactions} />
            </div>
          </div>
        ) : (
          <div className={card}>
            <h3 className="text-sm font-medium text-zinc-400">Health</h3>
            <div className="mt-4 flex flex-col items-center justify-center py-6">
              <div className="mb-2 h-3 w-3 rounded-full bg-emerald-400" />
              <p className="text-sm font-medium text-zinc-300">All clear</p>
              <p className="mt-1 text-xs text-zinc-500">
                {overview.valuedHoldingCount}/{overview.activeHoldingCount} holdings valued
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick stats row */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Unrealized P/L"
          value={formatSignedCurrencyPln(overview.totalUnrealizedGainPln)}
          change={Number(overview.totalUnrealizedGainPln) > 0 ? 'positive' : Number(overview.totalUnrealizedGainPln) < 0 ? 'negative' : 'neutral'}
        />
        <StatCard
          label="Net Contributions"
          value={formatCurrencyPln(overview.netContributionsPln)}
        />
        <StatCard
          label="Cash Balance"
          value={formatCurrencyPln(overview.cashBalancePln)}
        />
        <StatCard
          label="Valuation Coverage"
          value={`${overview.valuedHoldingCount} / ${overview.activeHoldingCount}`}
          subtitle={overview.unvaluedHoldingCount > 0 ? `${overview.unvaluedHoldingCount} unvalued` : 'Full coverage'}
        />
      </div>
    </>
  )
}

function AllocationLegend({ label, color, pct }: { label: string; color: string; pct: number }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label} {formatPercent(pct)}
    </span>
  )
}

function IssueRow({ label, count }: { label: string; count: number }) {
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums text-amber-400">{count}</span>
    </div>
  )
}

function filterHistoryPoints(points: PortfolioDailyHistoryPoint[], range: DashboardRange) {
  if (range === 'MAX' || points.length === 0) return points
  const latestDate = new Date(points.at(-1)?.date ?? points[0].date)
  const cutoff = new Date(latestDate)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  const cutoffString = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffString)
}
