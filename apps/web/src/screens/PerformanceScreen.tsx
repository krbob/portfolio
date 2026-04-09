import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout'
import { EmptyState, ErrorState, FadeIn, LoadingState, RefreshIndicator, StatCard, TabBar } from '../components/ui'
import { useBackgroundRefreshing } from '../hooks/use-background-refreshing'
import { usePortfolioDailyHistory, usePortfolioHoldings, usePortfolioOverview, usePortfolioReturns } from '../hooks/use-read-model'
import { usePortfolioBenchmarkSettings } from '../hooks/use-write-model'
import { missingDataLabel } from '../lib/availability'
import { resolveBenchmarkOrder } from '../lib/benchmarks'
import { formatCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'
import { isMarketValuationState } from '../lib/valuation'
import {
  ChartsTab,
  filterByPeriod,
  findReturnPeriod,
  formatReturn,
  returnChange,
  ReturnsTab,
  seriesForUnit,
  TABS,
} from './performance/PerformanceScreenSections'
import { PerformanceContributors } from './performance/PerformanceContributors'
import type { Period, Tab, Unit } from './performance/PerformanceScreenSections'

export function PerformanceScreen() {
  const { isPolish } = useI18n()
  const [tab, setTab] = useState<Tab>('charts')
  const [period, setPeriod] = useState<Period>('MAX')
  const [unit, setUnit] = useState<Unit>('PLN')

  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const returnsQuery = usePortfolioReturns()
  const holdingsQuery = usePortfolioHoldings()
  const benchmarkSettingsQuery = usePortfolioBenchmarkSettings()
  const isRefreshing = useBackgroundRefreshing([overviewQuery, historyQuery, returnsQuery, holdingsQuery])

  const allPoints = useMemo(() => historyQuery.data?.points ?? [], [historyQuery.data?.points])
  const allPeriods = useMemo(() => returnsQuery.data?.periods ?? [], [returnsQuery.data?.periods])
  const filteredPoints = useMemo(() => filterByPeriod(allPoints, period), [allPoints, period])
  const latest = filteredPoints.at(-1) ?? allPoints.at(-1)
  const returnsDisplayAvailable = isMarketValuationState(historyQuery.data?.valuationState)
  const benchmarkOrder = useMemo(() => resolveBenchmarkOrder(benchmarkSettingsQuery.data), [benchmarkSettingsQuery.data])
  const pinnedBenchmarkKeys = useMemo(
    () => benchmarkSettingsQuery.data?.pinnedKeys ?? [],
    [benchmarkSettingsQuery.data?.pinnedKeys],
  )
  const customBenchmarkLabels = useMemo(
    () =>
      Object.fromEntries(
        (benchmarkSettingsQuery.data?.customBenchmarks ?? []).map((benchmark) => [benchmark.key, benchmark.label]),
      ),
    [benchmarkSettingsQuery.data?.customBenchmarks],
  )

  const series = seriesForUnit(unit)

  // Featured returns for stat cards
  const ytdPeriod = findReturnPeriod(allPeriods, 'YTD')
  const y1Period = findReturnPeriod(allPeriods, 'ONE_YEAR')
  const inceptionPeriod = findReturnPeriod(allPeriods, 'MAX')
  const hasHistory = allPoints.length > 0
  const hasReturns = allPeriods.length > 0

  function handleRetry() {
    void Promise.all([historyQuery.refetch(), returnsQuery.refetch(), benchmarkSettingsQuery.refetch()])
  }

  if ((historyQuery.isLoading || returnsQuery.isLoading || holdingsQuery.isLoading) && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title={t('performance.title')} />
        <LoadingState
          title={t('performance.loadingTitle')}
          description={t('performance.loadingDescription')}
          blocks={4}
        />
      </>
    )
  }

  if (historyQuery.isError && returnsQuery.isError && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title={t('performance.title')} />
        <ErrorState
          title={t('performance.errorTitle')}
          description={t('performance.errorDescription')}
          onRetry={handleRetry}
        />
      </>
    )
  }

  if (!historyQuery.isLoading && !returnsQuery.isLoading && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title={t('performance.title')} />
        <EmptyState
          title={t('performance.emptyTitle')}
          description={t('performance.emptyDescription')}
          action={{ label: t('performance.emptyAction'), to: '/transactions' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('performance.title')}>
        <RefreshIndicator active={isRefreshing} />
      </PageHeader>

      <FadeIn>
      {/* Top stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('performance.latestValue')}
          value={overviewQuery.data ? formatCurrencyPln(overviewQuery.data.totalCurrentValuePln) : latest ? formatCurrencyPln(latest.totalCurrentValuePln) : missingDataLabel(isPolish)}
          subtitle={!overviewQuery.data && !latest ? t('performance.noDataSubtitle') : undefined}
        />
        <StatCard
          label="YTD MWRR"
          value={formatReturn(ytdPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable, isPolish)}
          change={returnChange(ytdPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable)}
          subtitle={!returnsDisplayAvailable || ytdPeriod?.nominalPln?.moneyWeightedReturn == null ? t('performance.noDataSubtitle') : undefined}
        />
        <StatCard
          label="1Y MWRR"
          value={formatReturn(y1Period?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable, isPolish)}
          change={returnChange(y1Period?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable)}
          subtitle={!returnsDisplayAvailable || y1Period?.nominalPln?.moneyWeightedReturn == null ? t('performance.noDataSubtitle') : undefined}
        />
        <StatCard
          label={t('performance.inceptionMwrr')}
          value={formatReturn(inceptionPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable, isPolish)}
          change={returnChange(inceptionPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable)}
          subtitle={!returnsDisplayAvailable || inceptionPeriod?.nominalPln?.moneyWeightedReturn == null ? t('performance.noDataSubtitle') : undefined}
        />
      </div>

      {/* Top/bottom contributors */}
      <PerformanceContributors holdings={holdingsQuery.data ?? []} />

      {/* Tab bar */}
      <TabBar
        tabs={TABS.map((tabItem) => ({
          ...tabItem,
          label: isPolish
            ? tabItem.value === 'charts'
              ? t('performance.tabCharts')
              : t('performance.tabReturns')
            : tabItem.label,
        }))}
        value={tab}
        onChange={setTab}
        ariaLabel={t('performance.workspaceLabel')}
        idBase="performance-workspace"
      />

      <div key={tab} className="mt-6 animate-fade-in">
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
              benchmarkOrder={benchmarkOrder}
              pinnedBenchmarkKeys={pinnedBenchmarkKeys}
              customBenchmarkLabels={customBenchmarkLabels}
            />
          </section>
        ) : (
          <section
            role="tabpanel"
            id="performance-workspace-panel-returns"
            aria-labelledby="performance-workspace-tab-returns"
          >
            <ReturnsTab
              returnsQuery={returnsQuery}
              returnsDisplayAvailable={returnsDisplayAvailable}
              period={period}
              onPeriodChange={setPeriod}
            />
          </section>
        )}
      </div>
      </FadeIn>
    </>
  )
}
