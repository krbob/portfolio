import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { MiniChart } from '../components/charts'
import { PageHeader } from '../components/layout'
import { StatCard, Badge, EmptyState, ErrorState, LoadingState, StatePanel } from '../components/ui'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import { usePortfolioAllocation, usePortfolioOverview, usePortfolioDailyHistory } from '../hooks/use-read-model'
import { formatCurrencyBreakdown, formatCurrencyPln, formatPercent, formatSignedCurrencyPln, hasMeaningfulCurrencyBreakdown } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAssetClass } from '../lib/labels'
import {
  describeAssetSliceValuation,
  describePortfolioValuationBasis,
  describePrimaryPortfolioValue,
  labelPortfolioValuationBasis,
  labelPrimaryPortfolioValueMetric,
} from '../lib/portfolio-presentation'
import { card } from '../lib/styles'
import { isBookOnlyValuationState, isMarketValuationState } from '../lib/valuation'

type DashboardRange = '1Y' | 'MAX'

export function DashboardScreen() {
  const { isPolish } = useI18n()
  const [range, setRange] = useState<DashboardRange>('1Y')
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const allocationQuery = usePortfolioAllocation()
  const dataQuality = usePortfolioDataQuality()
  const overview = overviewQuery.data

  const allPoints = historyQuery.data?.points ?? []
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
        <PageHeader title={isPolish ? 'Pulpit' : 'Dashboard'} />
        <LoadingState
          title={isPolish ? 'Ładowanie pulpitu' : 'Loading dashboard'}
          description={isPolish
            ? 'Przygotowywanie bieżącej wartości portfela, alokacji i najnowszej historii rynkowej.'
            : 'Preparing the current portfolio value, allocation and latest market-backed history.'}
          blocks={4}
        />
      </>
    )
  }

  if (overviewQuery.isError) {
    return (
      <>
        <PageHeader title={isPolish ? 'Pulpit' : 'Dashboard'} />
        <ErrorState
          title={isPolish ? 'Pulpit niedostępny' : 'Dashboard unavailable'}
          description={isPolish
            ? 'Nie udało się wczytać podsumowania portfela. Spróbuj ponownie albo sprawdź stan systemu w Ustawieniach.'
            : 'Portfolio overview could not load. Retry now or inspect system health in Settings.'}
          onRetry={handleRetry}
        />
      </>
    )
  }

  if (!overview) {
    return (
      <>
        <PageHeader title={isPolish ? 'Pulpit' : 'Dashboard'} />
        <EmptyState
          title={isPolish ? 'Witaj w Portfolio' : 'Welcome to Portfolio'}
          description={isPolish
            ? 'Dodaj konta i instrumenty, aby rozpocząć śledzenie portfela.'
            : 'Connect your accounts and add instruments to get started with portfolio tracking.'}
          action={{ label: isPolish ? 'Przejdź do ustawień' : 'Go to Settings', to: '/settings' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={isPolish ? 'Pulpit' : 'Dashboard'}>
        {latestPoint && (
          <span className="text-xs text-zinc-500">
            {isPolish ? 'Stan na' : 'As of'} {latestPoint.date} · {labelPortfolioValuationBasis(valuationState, isPolish)}
          </span>
        )}
      </PageHeader>

      {/* Hero stats */}
      <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={labelPrimaryPortfolioValueMetric(valuationState, isPolish)}
          value={formatCurrencyPln(displayedTotalValuePln)}
          subtitle={describePrimaryPortfolioValue(overview, valuationState, isPolish)}
          hero
        />
        <StatCard
          label={isPolish ? 'Zmiana dzienna' : 'Daily Change'}
          value={dailyChange != null ? formatSignedCurrencyPln(dailyChange) : (isPolish ? 'b/d' : 'N/A')}
          subtitle={dailyChangePct != null
            ? formatPercent(dailyChangePct, { signed: true })
            : hasMarketBackedCurrentValuation
              ? isPolish
                ? 'Czekamy na komplet danych'
                : 'Waiting for data'
              : isPolish
                ? 'Wymaga pełnej wyceny rynkowej'
                : 'Requires full market valuation'}
          change={dailyChange != null ? (dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'neutral') : undefined}
        />
        <StatCard
          label={isPolish ? 'Akcje' : 'Equities'}
          value={formatCurrencyPln(displayedEquityValuePln)}
          subtitle={describeAssetSliceValuation(equityPct, valuationState, isPolish)}
          dot="equity"
        />
        <StatCard
          label={isPolish ? 'Obligacje' : 'Bonds'}
          value={formatCurrencyPln(displayedBondValuePln)}
          subtitle={describeAssetSliceValuation(bondPct, valuationState, isPolish)}
          dot="bond"
        />
      </div>

      {/* Allocation bar */}
      <div className={`${card} mt-4`}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-zinc-400">{isPolish ? 'Alokacja' : 'Allocation'}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AllocationLegend label={isPolish ? 'Akcje' : 'Equities'} color="bg-blue-500" pct={equityPct} />
            <AllocationLegend label={isPolish ? 'Obligacje' : 'Bonds'} color="bg-amber-500" pct={bondPct} />
            <AllocationLegend label={isPolish ? 'Gotówka' : 'Cash'} color="bg-zinc-500" pct={cashPct} />
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
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-zinc-400">{labelPrimaryPortfolioValueMetric(historyValuationState, isPolish)}</h3>
              {historyValuationState !== 'MARK_TO_MARKET' ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {historyValuationState === 'BOOK_ONLY'
                    ? isPolish
                      ? 'Wykres opiera się na wycenie księgowej.'
                      : 'This chart is based on book basis.'
                    : historyValuationState === 'STALE'
                      ? isPolish
                        ? 'Wykres korzysta z ostatnich dostępnych cen rynkowych.'
                        : 'This chart uses the latest available market prices.'
                    : isPolish
                      ? 'Wykres łączy wyceny rynkowe z wyceną księgową.'
                      : 'This chart mixes market prices with book basis.'}
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
                  onClick={() => setRange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {historyQuery.isLoading && chartPoints.length === 0 ? (
            <LoadingState
              title={isPolish ? 'Ładowanie historii' : 'Loading history'}
              description={isPolish
                ? 'Pobieranie dziennej historii portfela dla wybranego zakresu.'
                : 'Fetching the daily portfolio curve for this dashboard range.'}
              variant="inline"
              blocks={2}
            />
          ) : historyQuery.isError && chartPoints.length === 0 ? (
            <ErrorState
              title={isPolish ? 'Historia niedostępna' : 'History unavailable'}
              description={isPolish
                ? 'Pulpit może pokazać bieżącą wartość, ale nie udało się wczytać wykresu historycznego.'
                : 'The dashboard can still show current value, but the historical chart did not load.'}
              onRetry={() => void historyQuery.refetch()}
              className="border-0 bg-transparent px-0 py-8"
            />
          ) : chartPoints.length === 0 ? (
            <StatePanel
              title={isPolish ? 'Brak historii portfela' : 'No history data yet'}
              description={isPolish
                ? 'Zapisz więcej transakcji albo wróć później do Wyników, aby zbudować krzywą portfela.'
                : 'Record more transactions or open Performance later to build out the portfolio curve.'}
              eyebrow={isPolish ? 'Historia' : 'History'}
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
              <div>
                <h3 className="text-sm font-medium text-zinc-400">{isPolish ? 'Odchylenie od celu' : 'Target drift'}</h3>
                {allocationQuery.data?.valuationState !== 'MARK_TO_MARKET' ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {allocationQuery.data?.valuationState === 'BOOK_ONLY'
                      ? isPolish
                        ? 'Sygnał alokacji opiera się na wycenie księgowej.'
                        : 'Allocation signal is based on book basis.'
                      : allocationQuery.data?.valuationState === 'STALE'
                        ? isPolish
                          ? 'Sygnał alokacji korzysta z ostatnich dostępnych cen rynkowych.'
                          : 'Allocation signal uses the latest available market prices.'
                      : isPolish
                        ? 'Sygnał alokacji łączy wyceny rynkowe z księgową.'
                        : 'Allocation signal mixes market prices with book basis.'}
                  </p>
                ) : null}
              </div>
              {allocationQuery.data?.configured ? (
                <Badge variant={allocationActionVariant(allocationQuery.data.recommendedAction)}>
                  {labelAllocationAction(allocationQuery.data.recommendedAction, isPolish)}
                </Badge>
              ) : (
                <Badge variant="default">{isPolish ? 'Brak konfiguracji' : 'Not configured'}</Badge>
              )}
            </div>

            {allocationQuery.isLoading ? (
              <div className="py-8">
                <LoadingState
                  title={isPolish ? 'Ładowanie alokacji docelowej' : 'Loading target allocation'}
                  description={isPolish
                    ? 'Wyliczanie wag docelowych, bieżącego odchylenia i sugestii rebalansowania przez kolejne wpłaty.'
                    : 'Resolving configured weights, current drift and contribution-first rebalance suggestions.'}
                  variant="inline"
                  blocks={2}
                />
              </div>
            ) : allocationQuery.isError ? (
              <ErrorState
                title={isPolish ? 'Odchylenie od celu niedostępne' : 'Target drift unavailable'}
                description={isPolish
                  ? 'Pulpit nie mógł wczytać odchylenia alokacji. Spróbuj ponownie albo sprawdź alokację w Ustawieniach.'
                  : 'The dashboard could not load allocation drift. Retry now or review allocation health in Settings.'}
                onRetry={() => void allocationQuery.refetch()}
                className="border-0 bg-transparent px-0 py-8"
              />
            ) : !allocationQuery.data?.configured ? (
              <StatePanel
                eyebrow={isPolish ? 'Strategia' : 'Strategy'}
                title={isPolish ? 'Brak skonfigurowanej alokacji docelowej' : 'No target allocation configured'}
                description={isPolish
                  ? 'Ustaw wagi docelowe, aby odblokować diagnostykę odchyleń, sugestie rebalansowania i benchmark alokacji docelowej.'
                  : 'Set target weights to unlock drift diagnostics, rebalance suggestions and the target-mix benchmark.'}
                className="border-0 bg-transparent px-0 py-8"
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${driftTone(mostOffTargetBucket?.driftPctPoints)}`}>
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
                      ? mostOffTargetBucket.withinTolerance
                        ? isPolish
                          ? `${labelAssetClass(mostOffTargetBucket.assetClass)} są najdalej od celu, ale nadal mieszczą się w paśmie.`
                          : `${labelAssetClass(mostOffTargetBucket.assetClass)} is furthest from target, but still inside the configured band.`
                        : isPolish
                          ? `${labelAssetClass(mostOffTargetBucket.assetClass)} są najdalej od celu.`
                          : `${labelAssetClass(mostOffTargetBucket.assetClass)} is furthest from target.`
                      : isPolish
                        ? 'Koszyki są zgodne ze skonfigurowaną alokacją.'
                        : 'Target buckets are aligned with the configured mix.'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {isPolish ? 'Pasmo tolerancji' : 'Tolerance band'} ±{formatPercent(allocationQuery.data.toleranceBandPctPoints, {
                      maximumFractionDigits: 2,
                      suffix: ' pp',
                    })} · {allocationQuery.data.breachedBucketCount} {isPolish ? 'poza zakresem' : 'outside band'}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-zinc-500">{isPolish ? 'Największa luka' : 'Largest gap'}</dt>
                    <dd className={`mt-1 font-medium ${gapTone(rebalanceBucket?.gapValuePln)}`}>
                      {rebalanceBucket ? formatSignedCurrencyPln(rebalanceBucket.gapValuePln) : formatSignedCurrencyPln(0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">
                      {allocationQuery.data.recommendedAction === 'DEPLOY_EXISTING_CASH'
                        ? (isPolish ? 'Dostępna gotówka' : 'Available cash')
                        : (isPolish ? 'Kolejna wpłata' : 'Next contribution')}
                    </dt>
                    <dd className="mt-1 font-medium text-zinc-100">
                      {allocationQuery.data.recommendedAssetClass && Number(allocationQuery.data.recommendedContributionPln) > 0
                        ? allocationQuery.data.recommendedAction === 'DEPLOY_EXISTING_CASH'
                          ? isPolish
                            ? `${formatCurrencyPln(allocationQuery.data.recommendedContributionPln)} gotówki -> ${labelAssetClass(allocationQuery.data.recommendedAssetClass)}`
                            : `${formatCurrencyPln(allocationQuery.data.recommendedContributionPln)} cash -> ${labelAssetClass(allocationQuery.data.recommendedAssetClass)}`
                          : `${formatCurrencyPln(allocationQuery.data.recommendedContributionPln)} -> ${labelAssetClass(allocationQuery.data.recommendedAssetClass)}`
                        : isPolish
                          ? 'Brak potrzeby rebalansowania przez wpłatę'
                          : 'No rebalance contribution needed'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{isPolish ? 'Pełny rebalance' : 'Full rebalance'}</dt>
                    <dd className="mt-1 font-medium text-zinc-100">
                      {formatCurrencyPln(allocationQuery.data.fullRebalanceBuyAmountPln)} / {formatCurrencyPln(allocationQuery.data.fullRebalanceSellAmountPln)}
                    </dd>
                  </div>
                </dl>

                <Link to="/settings#targets" className="inline-flex text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100">
                  {isPolish ? 'Otwórz alokację docelową' : 'Open target allocation'}
                </Link>
              </div>
            )}
          </div>

          {dataQuality.summary?.warningCount ? (
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-amber-400">{isPolish ? 'Jakość danych' : 'Data quality'}</h3>
                <Badge variant="warning">{dataQuality.summary.warningCount}</Badge>
              </div>
              <div className="space-y-3">
                {dataQuality.summary.noticeMessages.map((message) => (
                  <p key={message} className="text-sm text-zinc-300">
                    {message}
                  </p>
                ))}
              </div>
              <Link to="/settings#data-quality" className="mt-4 inline-flex text-sm font-medium text-amber-300 transition-colors hover:text-amber-200">
                {isPolish ? 'Otwórz szczegóły jakości danych' : 'Open data quality details'}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="mt-4 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isPolish ? 'Niezrealizowany zysk/strata' : 'Unrealized P/L'}
          value={hasMarketBackedCurrentValuation ? formatSignedCurrencyPln(overview.totalUnrealizedGainPln) : (isPolish ? 'b/d' : 'N/A')}
          subtitle={hasMarketBackedCurrentValuation
            ? undefined
            : isPolish
              ? 'Wymaga pełnej wyceny rynkowej'
              : 'Requires full market valuation'}
          change={hasMarketBackedCurrentValuation
            ? Number(overview.totalUnrealizedGainPln) > 0
              ? 'positive'
              : Number(overview.totalUnrealizedGainPln) < 0
                ? 'negative'
                : 'neutral'
            : undefined}
        />
        <StatCard
          label={isPolish ? 'Wpłaty netto' : 'Net Contributions'}
          value={formatCurrencyPln(overview.netContributionsPln)}
          subtitle={contributionBreakdownSubtitle}
        />
        <StatCard
          label={isPolish ? 'Saldo gotówki' : 'Cash Balance'}
          value={formatCurrencyPln(overview.cashBalancePln)}
          subtitle={cashBreakdownSubtitle}
        />
        <StatCard
          label={isPolish ? 'Podstawa wyceny' : 'Valuation basis'}
          value={labelPortfolioValuationBasis(valuationState, isPolish)}
          subtitle={describePortfolioValuationBasis(overview, isPolish)}
        />
      </div>
    </>
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

function labelAllocationAction(action: string, isPolish: boolean) {
  if (isPolish) {
    switch (action) {
      case 'WITHIN_TOLERANCE':
        return 'W tolerancji'
      case 'DEPLOY_EXISTING_CASH':
        return 'Wykorzystaj gotówkę'
      case 'WAIT_FOR_NEXT_CONTRIBUTION':
        return 'Poczekaj na kolejną wpłatę'
      case 'FULL_REBALANCE':
        return 'Pełny rebalancing'
      default:
        return 'Brak konfiguracji'
    }
  }

  switch (action) {
    case 'WITHIN_TOLERANCE':
      return 'Within tolerance'
    case 'DEPLOY_EXISTING_CASH':
      return 'Deploy cash'
    case 'WAIT_FOR_NEXT_CONTRIBUTION':
      return 'Wait for contribution'
    case 'FULL_REBALANCE':
      return 'Full rebalance'
    default:
      return 'Not configured'
  }
}

function filterHistoryPoints(points: PortfolioDailyHistoryPoint[], range: DashboardRange) {
  if (range === 'MAX' || points.length === 0) return points
  const latestDate = new Date(points.at(-1)?.date ?? points[0].date)
  const cutoff = new Date(latestDate)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  const cutoffString = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffString)
}
