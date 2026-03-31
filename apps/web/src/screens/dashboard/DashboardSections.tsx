import { Link } from 'react-router-dom'
import type { PortfolioAllocationBucket, PortfolioAllocationSummary, PortfolioDailyHistoryPoint, PortfolioHolding, PortfolioOverview } from '../../api/read-model'
import { MiniChart } from '../../components/charts'
import { Badge, ErrorState, LoadingState, StatCard, StatePanel } from '../../components/ui'
import { missingDataLabel } from '../../lib/availability'
import type { PortfolioDataQualitySummary } from '../../lib/data-quality'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../../lib/format'
import { labelAssetClass } from '../../lib/labels'
import { formatMessage, t } from '../../lib/messages'
import {
  describeAssetSliceValuation,
  describePortfolioValuationBasis,
  describePrimaryPortfolioValue,
  labelPortfolioValuationBasis,
  labelPrimaryPortfolioValueMetric,
} from '../../lib/portfolio-presentation'
import { card } from '../../lib/styles'

export function DashboardHeroStats({
  isPolish,
  overview,
  valuationState,
  displayedTotalValuePln,
  displayedEquityValuePln,
  displayedBondValuePln,
  dailyChange,
  dailyChangePct,
  hasMarketBackedCurrentValuation,
  equityPct,
  bondPct,
}: {
  isPolish: boolean
  overview: PortfolioOverview
  valuationState: string
  displayedTotalValuePln: string
  displayedEquityValuePln: string
  displayedBondValuePln: string
  dailyChange: number | null
  dailyChangePct: number | null
  hasMarketBackedCurrentValuation: boolean
  equityPct: number
  bondPct: number
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={labelPrimaryPortfolioValueMetric(valuationState, isPolish)}
        value={formatCurrencyPln(displayedTotalValuePln)}
        subtitle={describePrimaryPortfolioValue(overview, valuationState, isPolish)}
        hero
      />
      <StatCard
        label={t('dashboardSections.dailyChange')}
        value={dailyChange != null ? formatSignedCurrencyPln(dailyChange) : missingDataLabel(isPolish)}
        subtitle={dailyChangePct != null
          ? formatPercent(dailyChangePct, { signed: true })
          : hasMarketBackedCurrentValuation
            ? t('dashboardSections.waitingForData')
            : t('dashboardSections.requiresMarketValuation')}
        change={dailyChange != null ? (dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'neutral') : undefined}
      />
      <StatCard
        label={t('dashboardSections.equities')}
        value={formatCurrencyPln(displayedEquityValuePln)}
        subtitle={describeAssetSliceValuation(equityPct, valuationState, isPolish)}
        dot="equity"
      />
      <StatCard
        label={t('dashboardSections.bonds')}
        value={formatCurrencyPln(displayedBondValuePln)}
        subtitle={describeAssetSliceValuation(bondPct, valuationState, isPolish)}
        dot="bond"
      />
    </div>
  )
}

export function DashboardAllocationBar({
  equityPct,
  bondPct,
  cashPct,
}: {
  equityPct: number
  bondPct: number
  cashPct: number
}) {
  return (
    <div className={`${card} mt-4`}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-zinc-400">{t('dashboardSections.allocation')}</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <AllocationLegend label={t('dashboardSections.equities')} color="bg-blue-500" pct={equityPct} />
          <AllocationLegend label={t('dashboardSections.bonds')} color="bg-amber-500" pct={bondPct} />
          <AllocationLegend label={t('dashboardSections.cash')} color="bg-zinc-500" pct={cashPct} />
        </div>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-blue-500 transition-all" style={{ width: `${equityPct}%` }} />
        <div className="bg-amber-500 transition-all" style={{ width: `${bondPct}%` }} />
        <div className="bg-zinc-500 transition-all" style={{ width: `${cashPct}%` }} />
      </div>
    </div>
  )
}

export function DashboardHistoryCard({
  isPolish,
  historyValuationState,
  chartPoints,
  range,
  onRangeChange,
  onRetry,
  isLoading,
  isError,
}: {
  isPolish: boolean
  historyValuationState: string
  chartPoints: PortfolioDailyHistoryPoint[]
  range: '1Y' | 'MAX'
  onRangeChange: (value: '1Y' | 'MAX') => void
  onRetry: () => void
  isLoading: boolean
  isError: boolean
}) {
  return (
    <div className={`${card} lg:col-span-2`}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-400">{labelPrimaryPortfolioValueMetric(historyValuationState, isPolish)}</h3>
          {historyValuationState !== 'MARK_TO_MARKET' ? (
            <p className="mt-1 text-xs text-zinc-500">
              {historyValuationState === 'BOOK_ONLY'
                ? t('dashboardSections.chartBookBasis')
                : historyValuationState === 'STALE'
                  ? t('dashboardSections.chartStale')
                  : t('dashboardSections.chartMixed')}
            </p>
          ) : null}
        </div>
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
              onClick={() => onRangeChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {isLoading && chartPoints.length === 0 ? (
        <LoadingState
          title={t('dashboardSections.loadingHistory')}
          description={t('dashboardSections.loadingHistoryDescription')}
          variant="inline"
          blocks={2}
        />
      ) : isError && chartPoints.length === 0 ? (
        <ErrorState
          title={t('dashboardSections.historyUnavailable')}
          description={t('dashboardSections.historyErrorDescription')}
          onRetry={onRetry}
          className="border-0 bg-transparent px-0 py-8"
        />
      ) : chartPoints.length === 0 ? (
        <StatePanel
          title={t('dashboardSections.noHistoryTitle')}
          description={t('dashboardSections.noHistoryDescription')}
          eyebrow={t('dashboardSections.historyEyebrow')}
          className="border-0 bg-transparent px-0 py-8"
        />
      ) : (
        <Link to="/performance" className="block">
          <MiniChart points={chartPoints} height={200} />
        </Link>
      )}
    </div>
  )
}

export function DashboardTargetDriftCard({
  isPolish,
  allocation,
  isLoading,
  isError,
  onRetry,
}: {
  isPolish: boolean
  allocation: PortfolioAllocationSummary | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const buckets = allocation?.buckets.filter((b) => b.targetWeightPct != null) ?? []

  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-400">{t('dashboardSections.targetAllocation')}</h3>
          {allocation?.valuationState && allocation.valuationState !== 'MARK_TO_MARKET' ? (
            <p className="mt-1 text-xs text-zinc-500">
              {allocation.valuationState === 'BOOK_ONLY'
                ? t('dashboardSections.allocationBookBasis')
                : allocation.valuationState === 'STALE'
                  ? t('dashboardSections.allocationStale')
                  : t('dashboardSections.allocationMixed')}
            </p>
          ) : null}
        </div>
        {allocation?.configured ? (
          <Badge variant={allocationActionVariant(allocation.recommendedAction)}>
            {labelAllocationAction(allocation.recommendedAction, isPolish)}
          </Badge>
        ) : (
          <Badge variant="default">{t('dashboardSections.notConfigured')}</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="py-8">
          <LoadingState
            title={t('dashboardSections.loadingTargetAllocation')}
            description={t('dashboardSections.loadingTargetDescription')}
            variant="inline"
            blocks={2}
          />
        </div>
      ) : isError ? (
        <ErrorState
          title={t('dashboardSections.targetDriftUnavailable')}
          description={t('dashboardSections.targetDriftErrorDescription')}
          onRetry={onRetry}
          className="border-0 bg-transparent px-0 py-8"
        />
      ) : !allocation?.configured ? (
        <StatePanel
          eyebrow={t('dashboardSections.strategyEyebrow')}
          title={t('dashboardSections.noTargetTitle')}
          description={t('dashboardSections.noTargetDescription')}
          className="border-0 bg-transparent px-0 py-8"
        />
      ) : (
        <div className="space-y-4">
          {/* Hero recommendation */}
          <RecommendationHero allocation={allocation} />

          {/* Per-bucket bars */}
          <div className="space-y-2.5">
            {buckets.map((bucket) => (
              <AllocationBucketBar key={bucket.assetClass} bucket={bucket} />
            ))}
          </div>

          {/* Meta + link */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              ±{formatPercent(allocation.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })} {t('dashboardSections.toleranceMeta')} · {allocation.breachedBucketCount} {t('dashboardSections.outsideBand')}
            </p>
            <Link to="/settings#targets" className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100">
              {t('dashboardSections.openTargetAllocation')} →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendationHero({ allocation }: { allocation: PortfolioAllocationSummary }) {
  const amount = formatCurrencyPln(allocation.recommendedContributionPln)
  const assetClass = allocation.recommendedAssetClass ? labelAssetClass(allocation.recommendedAssetClass) : ''
  const band = formatPercent(allocation.toleranceBandPctPoints, { maximumFractionDigits: 2, suffix: ' pp' })
  const remainingGap = formatCurrencyPln(allocation.remainingContributionGapPln)

  let hero: string
  let subtitle: string | null = null

  switch (allocation.recommendedAction) {
    case 'WITHIN_TOLERANCE':
      hero = formatMessage(t('dashboardSections.withinToleranceHero'), { band })
      break
    case 'DEPLOY_EXISTING_CASH':
      hero = formatMessage(t('dashboardSections.deployCashHero'), { amount, assetClass })
      subtitle = t('dashboardSections.deployCashSub')
      break
    case 'WAIT_FOR_NEXT_CONTRIBUTION':
      hero = formatMessage(t('dashboardSections.contributionHero'), { amount, assetClass })
      subtitle = formatMessage(t('dashboardSections.contributionSub'), { amount: remainingGap })
      break
    case 'FULL_REBALANCE':
      hero = formatMessage(t('dashboardSections.fullRebalanceHero'), { amount: formatCurrencyPln(allocation.fullRebalanceBuyAmountPln) })
      subtitle = t('dashboardSections.fullRebalanceSub')
      break
    default:
      hero = ''
  }

  return (
    <div>
      <p className="text-sm font-medium text-zinc-100">{hero}</p>
      {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  )
}

const bucketColor: Record<string, string> = {
  EQUITIES: 'bg-blue-500',
  BONDS: 'bg-amber-500',
  CASH: 'bg-zinc-500',
}

function AllocationBucketBar({ bucket }: { bucket: PortfolioAllocationBucket }) {
  const actual = Number(bucket.currentWeightPct)
  const target = Number(bucket.targetWeightPct ?? 0)
  const scale = Math.max(actual, target, 1) * 1.25
  const barWidth = (actual / scale) * 100
  const markerPos = (target / scale) * 100
  const withinTolerance = bucket.withinTolerance
  const color = bucketColor[bucket.assetClass] ?? 'bg-zinc-500'

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-zinc-400">{labelAssetClass(bucket.assetClass)}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${barWidth}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-zinc-300/60"
          style={{ left: `${markerPos}%` }}
        />
      </div>
      <span className={`w-24 shrink-0 text-right text-xs tabular-nums ${withinTolerance ? 'text-zinc-400' : 'text-amber-400'}`}>
        {formatPercent(actual)} / {formatPercent(target)}
      </span>
    </div>
  )
}

export function DashboardDataQualityCard({
  summary,
}: {
  summary: PortfolioDataQualitySummary | null | undefined
}) {
  if (!summary?.warningCount) {
    return null
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-amber-400">{t('dashboardSections.dataQuality')}</h3>
        <Badge variant="warning">{summary.warningCount}</Badge>
      </div>
      <div className="space-y-3">
        {summary.noticeMessages.map((message) => (
          <p key={message} className="text-sm text-zinc-300">
            {message}
          </p>
        ))}
      </div>
      <Link to="/settings#data-quality" className="mt-4 inline-flex text-sm font-medium text-amber-300 transition-colors hover:text-amber-200">
        {t('dashboardSections.openDataQuality')}
      </Link>
    </div>
  )
}

export function DashboardQuickStats({
  isPolish,
  overview,
  valuationState,
  hasMarketBackedCurrentValuation,
  contributionBreakdownSubtitle,
  cashBreakdownSubtitle,
}: {
  isPolish: boolean
  overview: PortfolioOverview
  valuationState: string
  hasMarketBackedCurrentValuation: boolean
  contributionBreakdownSubtitle?: string
  cashBreakdownSubtitle?: string
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t('dashboardSections.unrealizedPL')}
        value={hasMarketBackedCurrentValuation ? formatSignedCurrencyPln(overview.totalUnrealizedGainPln) : missingDataLabel(isPolish)}
        subtitle={hasMarketBackedCurrentValuation
          ? undefined
          : t('dashboardSections.requiresMarketValuation')}
        change={hasMarketBackedCurrentValuation
          ? Number(overview.totalUnrealizedGainPln) > 0
            ? 'positive'
            : Number(overview.totalUnrealizedGainPln) < 0
              ? 'negative'
              : 'neutral'
          : undefined}
      />
      <StatCard
        label={t('dashboardSections.netContributions')}
        value={formatCurrencyPln(overview.netContributionsPln)}
        subtitle={contributionBreakdownSubtitle}
      />
      <StatCard
        label={t('dashboardSections.cashBalance')}
        value={formatCurrencyPln(overview.cashBalancePln)}
        subtitle={cashBreakdownSubtitle}
      />
      <StatCard
        label={t('dashboardSections.valuationBasis')}
        value={labelPortfolioValuationBasis(valuationState, isPolish)}
        subtitle={describePortfolioValuationBasis(overview, isPolish)}
      />
    </div>
  )
}

export function DashboardContributorsCard({ holdings }: { holdings: PortfolioHolding[] }) {
  const ranked = holdings
    .filter((h) => h.unrealizedGainPln != null)
    .map((h) => ({ instrumentName: h.instrumentName, gain: Number(h.unrealizedGainPln) }))
    .filter((h) => !Number.isNaN(h.gain))

  if (ranked.length === 0) {
    return null
  }

  const topGainer = [...ranked].sort((a, b) => b.gain - a.gain)[0]
  const topLoser = [...ranked].sort((a, b) => a.gain - b.gain)[0]

  return (
    <div className={`${card} mt-4`}>
      <h3 className="mb-3 text-sm font-medium text-zinc-400">{t('dashboard.contributors')}</h3>
      <div className="grid grid-cols-2 gap-4">
        {topGainer && (
          <div>
            <p className="text-xs font-medium text-zinc-500">{t('dashboard.topGainer')}</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-100">{topGainer.instrumentName}</p>
            <p className="mt-0.5 text-sm font-medium text-emerald-400">{formatSignedCurrencyPln(topGainer.gain)}</p>
          </div>
        )}
        {topLoser && (
          <div>
            <p className="text-xs font-medium text-zinc-500">{t('dashboard.topLoser')}</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-100">{topLoser.instrumentName}</p>
            <p className={`mt-0.5 text-sm font-medium ${topLoser.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatSignedCurrencyPln(topLoser.gain)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AllocationLegend({ label, color, pct }: { label: string; color: string; pct: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 sm:text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label} {formatPercent(pct)}
    </span>
  )
}

function allocationActionVariant(action: string) {
  switch (action) {
    case 'WITHIN_TOLERANCE':
      return 'success' as const
    case 'DEPLOY_EXISTING_CASH':
      return 'info' as const
    case 'WAIT_FOR_NEXT_CONTRIBUTION':
      return 'warning' as const
    case 'FULL_REBALANCE':
      return 'error' as const
    default:
      return 'default' as const
  }
}

function labelAllocationAction(action: string, _isPolish: boolean) {
  switch (action) {
    case 'WITHIN_TOLERANCE':
      return t('dashboardSections.withinTolerance')
    case 'DEPLOY_EXISTING_CASH':
      return t('dashboardSections.deployCash')
    case 'WAIT_FOR_NEXT_CONTRIBUTION':
      return t('dashboardSections.waitForContribution')
    case 'FULL_REBALANCE':
      return t('dashboardSections.fullRebalanceAction')
    default:
      return t('dashboardSections.notConfiguredAction')
  }
}
