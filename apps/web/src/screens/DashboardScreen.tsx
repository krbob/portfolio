import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import { usePortfolioAllocation, usePortfolioOverview, usePortfolioDailyHistory } from '../hooks/use-read-model'
import { formatCurrencyBreakdown, hasMeaningfulCurrencyBreakdown } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'
import { labelPortfolioValuationBasis } from '../lib/portfolio-presentation'
import { isBookOnlyValuationState, isMarketValuationState } from '../lib/valuation'
import {
  DashboardAllocationBar,
  DashboardDataQualityCard,
  DashboardHeroStats,
  DashboardHistoryCard,
  DashboardQuickStats,
  DashboardTargetDriftCard,
} from './dashboard/DashboardSections'

type DashboardRange = '1Y' | 'MAX'

export function DashboardScreen() {
  const { isPolish } = useI18n()
  const [range, setRange] = useState<DashboardRange>('1Y')
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const allocationQuery = usePortfolioAllocation()
  const dataQuality = usePortfolioDataQuality()
  const overview = overviewQuery.data

  const allPoints = useMemo(() => historyQuery.data?.points ?? [], [historyQuery.data?.points])
  const chartPoints = useMemo(() => filterHistoryPoints(allPoints, range), [allPoints, range])
  const latestPoint = chartPoints.at(-1) ?? allPoints.at(-1)
  const previousPoint = chartPoints.at(-2) ?? allPoints.at(-2)
  const valuationState = overview?.valuationState ?? 'MARK_TO_MARKET'
  const historyValuationState = historyQuery.data?.valuationState ?? valuationState
  const usesBookBasisOnly = isBookOnlyValuationState(valuationState)
  const hasMarketBackedCurrentValuation = isMarketValuationState(valuationState)
  const hasMarketBackedHistoryValuation =
    isMarketValuationState(historyValuationState) &&
    Boolean(latestPoint) &&
    Boolean(previousPoint) &&
    latestPoint!.activeHoldingCount === latestPoint!.valuedHoldingCount &&
    previousPoint!.activeHoldingCount === previousPoint!.valuedHoldingCount

  const dailyChange =
    hasMarketBackedHistoryValuation && latestPoint && previousPoint
      ? Number(latestPoint.totalCurrentValuePln) - Number(previousPoint.totalCurrentValuePln)
      : null
  const dailyChangePct =
    dailyChange != null && previousPoint && Number(previousPoint.totalCurrentValuePln) !== 0
      ? (dailyChange / Number(previousPoint.totalCurrentValuePln)) * 100
      : null

  const displayedTotalValuePln = overview
    ? usesBookBasisOnly
      ? overview.totalBookValuePln
      : overview.totalCurrentValuePln
    : '0'
  const displayedEquityValuePln = overview
    ? usesBookBasisOnly
      ? overview.equityBookValuePln
      : overview.equityCurrentValuePln
    : '0'
  const displayedBondValuePln = overview
    ? usesBookBasisOnly
      ? overview.bondBookValuePln
      : overview.bondCurrentValuePln
    : '0'
  const displayedCashValuePln = overview
    ? usesBookBasisOnly
      ? overview.cashBookValuePln
      : overview.cashCurrentValuePln
    : '0'
  const totalCurrentValue = overview ? Number(displayedTotalValuePln) : 0
  const equityPct = overview && totalCurrentValue > 0 ? (Number(displayedEquityValuePln) / totalCurrentValue) * 100 : 0
  const bondPct = overview && totalCurrentValue > 0 ? (Number(displayedBondValuePln) / totalCurrentValue) * 100 : 0
  const cashPct = overview && totalCurrentValue > 0 ? (Number(displayedCashValuePln) / totalCurrentValue) * 100 : 0
  const cashBreakdownSubtitle = hasMeaningfulCurrencyBreakdown(overview?.cashBalances) ? formatCurrencyBreakdown(overview?.cashBalances)
    : undefined
  const contributionBreakdownSubtitle = hasMeaningfulCurrencyBreakdown(overview?.netContributionBalances)
    ? formatCurrencyBreakdown(overview?.netContributionBalances)
    : undefined

  const configuredBuckets = useMemo(
    () => allocationQuery.data?.buckets.filter((bucket) => bucket.targetWeightPct != null) ?? [],
    [allocationQuery.data?.buckets],
  )
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
      if (bucket.rebalanceAction !== 'BUY' || !bucket.gapValuePln || Number(bucket.gapValuePln) <= 0) {
        return current
      }
      if (current == null || Number(bucket.gapValuePln) > Number(current.gapValuePln ?? 0)) {
        return bucket
      }
      return current
    }, null)
  }, [configuredBuckets])

  function handleRetry() {
    void Promise.all([overviewQuery.refetch(), historyQuery.refetch()])
  }

  if (overviewQuery.isLoading) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <LoadingState
          title={t('dashboard.loadingTitle')}
          description={t('dashboard.loadingDescription')}
          blocks={4}
        />
      </>
    )
  }

  if (overviewQuery.isError) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <ErrorState
          title={t('dashboard.errorTitle')}
          description={t('dashboard.errorDescription')}
          onRetry={handleRetry}
        />
      </>
    )
  }

  if (!overview) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <EmptyState
          title={t('dashboard.welcomeTitle')}
          description={t('dashboard.welcomeDescription')}
          action={{ label: t('dashboard.welcomeAction'), to: '/accounts' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('dashboard.title')}>
        {latestPoint && (
          <span className="text-xs text-zinc-500">
            {t('dashboard.asOf')} {latestPoint.date} · {labelPortfolioValuationBasis(valuationState, isPolish)}
          </span>
        )}
      </PageHeader>

      <DashboardHeroStats
        isPolish={isPolish}
        overview={overview}
        valuationState={valuationState}
        displayedTotalValuePln={displayedTotalValuePln}
        displayedEquityValuePln={displayedEquityValuePln}
        displayedBondValuePln={displayedBondValuePln}
        dailyChange={dailyChange}
        dailyChangePct={dailyChangePct}
        hasMarketBackedCurrentValuation={hasMarketBackedCurrentValuation}
        equityPct={equityPct}
        bondPct={bondPct}
      />

      <DashboardAllocationBar
        equityPct={equityPct}
        bondPct={bondPct}
        cashPct={cashPct}
      />

      {/* Chart + Strategy / Issues side by side */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardHistoryCard
          isPolish={isPolish}
          historyValuationState={historyValuationState}
          chartPoints={chartPoints}
          range={range}
          onRangeChange={setRange}
          onRetry={() => void historyQuery.refetch()}
          isLoading={historyQuery.isLoading}
          isError={historyQuery.isError}
        />

        <div className="space-y-4">
          <DashboardTargetDriftCard
            isPolish={isPolish}
            allocation={allocationQuery.data}
            mostOffTargetBucket={mostOffTargetBucket}
            rebalanceBucket={rebalanceBucket}
            isLoading={allocationQuery.isLoading}
            isError={allocationQuery.isError}
            onRetry={() => void allocationQuery.refetch()}
          />

          <DashboardDataQualityCard
            summary={dataQuality.summary}
          />
        </div>
      </div>

      <DashboardQuickStats
        isPolish={isPolish}
        overview={overview}
        valuationState={valuationState}
        hasMarketBackedCurrentValuation={hasMarketBackedCurrentValuation}
        contributionBreakdownSubtitle={contributionBreakdownSubtitle}
        cashBreakdownSubtitle={cashBreakdownSubtitle}
      />
    </>
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
