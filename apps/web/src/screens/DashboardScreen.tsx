import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { MiniChart } from '../components/charts'
import { PageHeader } from '../components/layout'
import { StatCard, Badge, EmptyState, ErrorState, LoadingState, StatePanel } from '../components/ui'
import { usePortfolioAllocation, usePortfolioOverview, usePortfolioDailyHistory } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { card } from '../lib/styles'

type DashboardRange = '1Y' | 'MAX'

export function DashboardScreen() {
  const [range, setRange] = useState<DashboardRange>('1Y')
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const allocationQuery = usePortfolioAllocation()
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
  const configuredBuckets = allocationQuery.data?.buckets.filter((bucket) => bucket.targetWeightPct != null) ?? []
  const mostOffTargetBucket = useMemo(() => {
    return configuredBuckets.reduce<typeof configuredBuckets[number] | null>((current, bucket) => {
      if (!bucket.driftPctPoints) {
        return current
      }
      if (current == null || Math.abs(Number(bucket.driftPctPoints)) > Math.abs(Number(current.driftPctPoints ?? 0))) {
        return bucket
      }
      return current
    }, null)
  }, [configuredBuckets])
  const rebalanceBucket = useMemo(() => {
    return configuredBuckets.reduce<typeof configuredBuckets[number] | null>((current, bucket) => {
      if (!bucket.gapValuePln || Number(bucket.gapValuePln) <= 0) {
        return current
      }
      if (current == null || Number(bucket.gapValuePln) > Number(current.gapValuePln ?? 0)) {
        return bucket
      }
      return current
    }, null)
  }, [configuredBuckets])
  const allTargetsOnTrack = configuredBuckets.length > 0 && configuredBuckets.every((bucket) => bucket.status === 'ON_TARGET')

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

      {/* Chart + Strategy / Issues side by side */}
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
              variant="inline"
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

        <div className="space-y-4">
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400">Target drift</h3>
              {allocationQuery.data?.configured ? (
                <Badge variant={allTargetsOnTrack ? 'success' : 'warning'}>
                  {allTargetsOnTrack ? 'On target' : 'Needs attention'}
                </Badge>
              ) : (
                <Badge variant="default">Not configured</Badge>
              )}
            </div>

            {allocationQuery.isLoading ? (
              <div className="py-8">
                <LoadingState
                  title="Loading target allocation"
                  description="Resolving configured weights, current drift and contribution-first rebalance suggestions."
                  variant="inline"
                  blocks={2}
                />
              </div>
            ) : allocationQuery.isError ? (
              <ErrorState
                title="Target drift unavailable"
                description="The dashboard could not load allocation drift. Retry now or review allocation health in Settings."
                onRetry={() => void allocationQuery.refetch()}
                className="border-0 bg-transparent px-0 py-8"
              />
            ) : !allocationQuery.data?.configured ? (
              <StatePanel
                eyebrow="Strategy"
                title="No target allocation configured"
                description="Set target weights to unlock drift diagnostics, rebalance suggestions and the target-mix benchmark."
                className="border-0 bg-transparent px-0 py-8"
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className={`text-3xl font-bold tabular-nums ${driftTone(mostOffTargetBucket?.driftPctPoints)}`}>
                    {mostOffTargetBucket
                      ? formatPercent(mostOffTargetBucket.driftPctPoints, {
                          signed: true,
                          maximumFractionDigits: 2,
                          suffix: ' pp',
                        })
                      : '0.00 pp'}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {mostOffTargetBucket
                      ? `${prettyAssetClass(mostOffTargetBucket.assetClass)} is furthest from its target weight.`
                      : 'Target buckets are aligned with the configured mix.'}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Largest gap</dt>
                    <dd className={`mt-1 font-medium ${gapTone(rebalanceBucket?.gapValuePln)}`}>
                      {rebalanceBucket ? formatSignedCurrencyPln(rebalanceBucket.gapValuePln) : '0,00 zł'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Next contribution</dt>
                    <dd className="mt-1 font-medium text-zinc-100">
                      {rebalanceBucket && Number(rebalanceBucket.suggestedContributionPln) > 0
                        ? `${formatCurrencyPln(rebalanceBucket.suggestedContributionPln)} -> ${prettyAssetClass(rebalanceBucket.assetClass)}`
                        : 'No rebalance contribution needed'}
                    </dd>
                  </div>
                </dl>

                <Link to="/settings#targets" className="inline-flex text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100">
                  Open target allocation
                </Link>
              </div>
            )}

            {/* Compact health footer */}
            <HealthIndicator
              valuedCount={overview.valuedHoldingCount}
              totalCount={overview.activeHoldingCount}
              issueCount={openIssues}
            />
          </div>

          {openIssues > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-amber-400">Data issues</h3>
                <Badge variant="warning">{openIssues}</Badge>
              </div>
              <div className="space-y-3">
                <IssueRow label="Valuation gaps" count={overview.valuationIssueCount} />
                <IssueRow label="Missing FX" count={overview.missingFxTransactions} />
                <IssueRow label="Unsupported corrections" count={overview.unsupportedCorrectionTransactions} />
              </div>
              <Link to="/settings#health" className="mt-4 inline-flex text-sm font-medium text-amber-300 transition-colors hover:text-amber-200">
                Open health details
              </Link>
            </div>
          )}
        </div>
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

function prettyAssetClass(assetClass: string) {
  switch (assetClass) {
    case 'EQUITIES':
      return 'Equities'
    case 'BONDS':
      return 'Bonds'
    case 'CASH':
      return 'Cash'
    default:
      return assetClass
  }
}

function driftTone(value: string | null | undefined) {
  if (value == null) {
    return 'text-zinc-100'
  }

  const numeric = Math.abs(Number(value))
  if (Number.isNaN(numeric) || numeric === 0) {
    return 'text-zinc-100'
  }
  if (numeric < 2) {
    return 'text-emerald-400'
  }
  if (numeric < 5) {
    return 'text-amber-400'
  }
  return 'text-red-400'
}

function gapTone(value: string | null | undefined) {
  if (value == null) {
    return 'text-zinc-100'
  }

  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric === 0) {
    return 'text-zinc-100'
  }
  return numeric > 0 ? 'text-amber-400' : 'text-sky-400'
}

function HealthIndicator({ valuedCount, totalCount, issueCount }: { valuedCount: number; totalCount: number; issueCount: number }) {
  const fullCoverage = valuedCount === totalCount
  const healthy = fullCoverage && issueCount === 0

  return (
    <div className="mt-4 flex items-center gap-2 border-t border-zinc-800/50 pt-3 text-xs">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="text-zinc-500">
        {valuedCount}/{totalCount} valued
        {issueCount > 0 && <span className="text-amber-400"> · {issueCount} {issueCount === 1 ? 'issue' : 'issues'}</span>}
        {issueCount === 0 && fullCoverage && <span className="text-emerald-400/70"> · All clear</span>}
        {issueCount === 0 && !fullCoverage && <span className="text-amber-400"> · {totalCount - valuedCount} unvalued</span>}
      </span>
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
