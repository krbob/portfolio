import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout'
import { EmptyState, ErrorState, LoadingState, StatCard, TabBar } from '../components/ui'
import { usePortfolioDailyHistory, usePortfolioReturns } from '../hooks/use-read-model'
import { missingDataLabel } from '../lib/availability'
import { formatCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
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
import type { Period, Tab, Unit } from './performance/PerformanceScreenSections'

export function PerformanceScreen() {
  const { isPolish } = useI18n()
  const [tab, setTab] = useState<Tab>('charts')
  const [period, setPeriod] = useState<Period>('MAX')
  const [unit, setUnit] = useState<Unit>('PLN')

  const historyQuery = usePortfolioDailyHistory()
  const returnsQuery = usePortfolioReturns()

  const allPoints = historyQuery.data?.points ?? []
  const allPeriods = returnsQuery.data?.periods ?? []
  const filteredPoints = useMemo(() => filterByPeriod(allPoints, period), [allPoints, period])
  const latest = filteredPoints.at(-1) ?? allPoints.at(-1)
  const returnsDisplayAvailable = isMarketValuationState(historyQuery.data?.valuationState)

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

  if ((historyQuery.isLoading || returnsQuery.isLoading) && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title={isPolish ? 'Wyniki' : 'Performance'} />
        <LoadingState
          title={isPolish ? 'Ładowanie wyników' : 'Loading performance'}
          description={isPolish
            ? 'Przygotowywanie historii, zwrotów i porównań z benchmarkami dla portfela.'
            : 'Preparing history, returns and benchmark comparisons for the portfolio.'}
          blocks={4}
        />
      </>
    )
  }

  if (historyQuery.isError && returnsQuery.isError && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title={isPolish ? 'Wyniki' : 'Performance'} />
        <ErrorState
          title={isPolish ? 'Wyniki niedostępne' : 'Performance unavailable'}
          description={isPolish
            ? 'Nie udało się wczytać historii i zwrotów. Spróbuj ponownie albo sprawdź bazę danych oraz gotowość źródeł rynkowych.'
            : 'History and return read models could not load. Retry now or inspect storage and market-data readiness.'}
          onRetry={handleRetry}
        />
      </>
    )
  }

  if (!historyQuery.isLoading && !returnsQuery.isLoading && !hasHistory && !hasReturns) {
    return (
      <>
        <PageHeader title={isPolish ? 'Wyniki' : 'Performance'} />
        <EmptyState
          title={isPolish ? 'Brak danych o wynikach' : 'No performance data yet'}
          description={isPolish
            ? 'Najpierw zapisz transakcje, aby Portfolio mogło odtworzyć historię dzienną, zwroty i benchmarki.'
            : 'Record transactions first so Portfolio can reconstruct daily history, returns and benchmarks.'}
          action={{ label: isPolish ? 'Otwórz transakcje' : 'Open Transactions', to: '/transactions' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={isPolish ? 'Wyniki' : 'Performance'} />

      {/* Top stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={isPolish ? 'Ostatnia wartość' : 'Latest Value'}
          value={latest ? formatCurrencyPln(latest.totalCurrentValuePln) : missingDataLabel(isPolish)}
        />
        <StatCard
          label="YTD MWRR"
          value={formatReturn(ytdPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable, isPolish)}
          change={returnChange(ytdPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable)}
        />
        <StatCard
          label="1Y MWRR"
          value={formatReturn(y1Period?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable, isPolish)}
          change={returnChange(y1Period?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable)}
        />
        <StatCard
          label={isPolish ? 'MWRR od początku' : 'Inception MWRR'}
          value={formatReturn(inceptionPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable, isPolish)}
          change={returnChange(inceptionPeriod?.nominalPln?.moneyWeightedReturn, returnsDisplayAvailable)}
        />
      </div>

      {/* Tab bar */}
      <TabBar
        tabs={TABS.map((tabItem) => ({
          ...tabItem,
          label: isPolish
            ? tabItem.value === 'charts'
              ? 'Wykresy'
              : 'Zwroty'
            : tabItem.label,
        }))}
        value={tab}
        onChange={setTab}
        ariaLabel={isPolish ? 'Przestrzeń wyników' : 'Performance workspace'}
        idBase="performance-workspace"
      />

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
            <ReturnsTab
              returnsQuery={returnsQuery}
              returnsDisplayAvailable={returnsDisplayAvailable}
              period={period}
              onPeriodChange={setPeriod}
            />
          </section>
        )}
      </div>
    </>
  )
}
