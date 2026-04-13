import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { DashboardSetupBanner } from '../components/DashboardSetupBanner'
import { StaleMarketDataAlert } from '../components/StaleMarketDataAlert'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import { useStaleMarketDataAlert } from '../hooks/use-stale-market-data-alert'
import { useBackgroundRefreshing } from '../hooks/use-background-refreshing'
import { usePortfolioAllocation, usePortfolioOverview, usePortfolioDailyHistory } from '../hooks/use-read-model'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'
import { labelPortfolioValuationBasis } from '../lib/portfolio-presentation'
import { appRoutes } from '../lib/routes'
import { isBookOnlyValuationState, isMarketValuationState } from '../lib/valuation'
import { FadeIn, RefreshIndicator } from '../components/ui'
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
  const staleAlert = useStaleMarketDataAlert()
  const isRefreshing = useBackgroundRefreshing([overviewQuery, historyQuery, allocationQuery])
  const overview = overviewQuery.data

  const allPoints = useMemo(() => historyQuery.data?.points ?? [], [historyQuery.data?.points])
  const chartPoints = useMemo(() => filterHistoryPoints(allPoints, range), [allPoints, range])
  const valuationState = overview?.valuationState ?? 'MARK_TO_MARKET'
  const historyValuationState = historyQuery.data?.valuationState ?? valuationState
  const usesBookBasisOnly = isBookOnlyValuationState(valuationState)
  const hasMarketBackedCurrentValuation = isMarketValuationState(valuationState)

  // Daily change = current value - previous close value (both from overview, same price source)
  const previousCloseValue = overview?.totalPreviousCloseValuePln != null ? Number(overview.totalPreviousCloseValuePln) : null
  const currentValue = overview != null ? Number(overview.totalCurrentValuePln) : null
  const dailyChange =
    hasMarketBackedCurrentValuation && currentValue != null && previousCloseValue != null
      ? currentValue - previousCloseValue
      : null
  const dailyChangePct =
    dailyChange != null && previousCloseValue != null && previousCloseValue !== 0
      ? (dailyChange / previousCloseValue) * 100
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
  const cashBreakdownSubtitle = undefined
  const contributionBreakdownSubtitle = undefined

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
          action={{ label: t('dashboard.welcomeAction'), to: appRoutes.portfolio.accounts }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('dashboard.title')}>
        <RefreshIndicator active={isRefreshing} />
        <span className="text-xs text-zinc-500">
          {t('dashboard.asOf')} {overview.asOf} · {labelPortfolioValuationBasis(valuationState, isPolish)}
        </span>
      </PageHeader>

      <StaleMarketDataAlert alert={staleAlert.alert} />

      <DashboardSetupBanner />

      <FadeIn className="mt-6">
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
        historyLoading={overviewQuery.isFetching}
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
          isRefreshing={historyQuery.isFetching && !historyQuery.isLoading}
        />

        <div className="space-y-4">
          <DashboardTargetDriftCard
            isPolish={isPolish}
            allocation={allocationQuery.data}
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
      </FadeIn>
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
