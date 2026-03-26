import { Link } from 'react-router-dom'
import type { PortfolioAllocationBucket, PortfolioAllocationSummary, PortfolioDailyHistoryPoint, PortfolioOverview } from '../../api/read-model'
import { MiniChart } from '../../components/charts'
import { Badge, ErrorState, LoadingState, StatCard, StatePanel } from '../../components/ui'
import type { PortfolioDataQualitySummary } from '../../lib/data-quality'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../../lib/format'
import { labelAssetClass } from '../../lib/labels'
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
  )
}

export function DashboardAllocationBar({
  isPolish,
  equityPct,
  bondPct,
  cashPct,
}: {
  isPolish: boolean
  equityPct: number
  bondPct: number
  cashPct: number
}) {
  return (
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
              onClick={() => onRangeChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {isLoading && chartPoints.length === 0 ? (
        <LoadingState
          title={isPolish ? 'Ładowanie historii' : 'Loading history'}
          description={isPolish
            ? 'Pobieranie dziennej historii portfela dla wybranego zakresu.'
            : 'Fetching the daily portfolio curve for this dashboard range.'}
          variant="inline"
          blocks={2}
        />
      ) : isError && chartPoints.length === 0 ? (
        <ErrorState
          title={isPolish ? 'Historia niedostępna' : 'History unavailable'}
          description={isPolish
            ? 'Pulpit może pokazać bieżącą wartość, ale nie udało się wczytać wykresu historycznego.'
            : 'The dashboard can still show current value, but the historical chart did not load.'}
          onRetry={onRetry}
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
  )
}

export function DashboardTargetDriftCard({
  isPolish,
  allocation,
  mostOffTargetBucket,
  rebalanceBucket,
  isLoading,
  isError,
  onRetry,
}: {
  isPolish: boolean
  allocation: PortfolioAllocationSummary | undefined
  mostOffTargetBucket: PortfolioAllocationBucket | null
  rebalanceBucket: PortfolioAllocationBucket | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-400">{isPolish ? 'Odchylenie od celu' : 'Target drift'}</h3>
          {allocation?.valuationState !== 'MARK_TO_MARKET' ? (
            <p className="mt-1 text-xs text-zinc-500">
              {allocation?.valuationState === 'BOOK_ONLY'
                ? isPolish
                  ? 'Sygnał alokacji opiera się na wycenie księgowej.'
                  : 'Allocation signal is based on book basis.'
                : allocation?.valuationState === 'STALE'
                  ? isPolish
                    ? 'Sygnał alokacji korzysta z ostatnich dostępnych cen rynkowych.'
                    : 'Allocation signal uses the latest available market prices.'
                  : isPolish
                    ? 'Sygnał alokacji łączy wyceny rynkowe z księgową.'
                    : 'Allocation signal mixes market prices with book basis.'}
            </p>
          ) : null}
        </div>
        {allocation?.configured ? (
          <Badge variant={allocationActionVariant(allocation.recommendedAction)}>
            {labelAllocationAction(allocation.recommendedAction, isPolish)}
          </Badge>
        ) : (
          <Badge variant="default">{isPolish ? 'Brak konfiguracji' : 'Not configured'}</Badge>
        )}
      </div>

      {isLoading ? (
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
      ) : isError ? (
        <ErrorState
          title={isPolish ? 'Odchylenie od celu niedostępne' : 'Target drift unavailable'}
          description={isPolish
            ? 'Pulpit nie mógł wczytać odchylenia alokacji. Spróbuj ponownie albo sprawdź alokację w Ustawieniach.'
            : 'The dashboard could not load allocation drift. Retry now or review allocation health in Settings.'}
          onRetry={onRetry}
          className="border-0 bg-transparent px-0 py-8"
        />
      ) : !allocation?.configured ? (
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
              {isPolish ? 'Pasmo tolerancji' : 'Tolerance band'} ±{formatPercent(allocation.toleranceBandPctPoints, {
                maximumFractionDigits: 2,
                suffix: ' pp',
              })} · {allocation.breachedBucketCount} {isPolish ? 'poza zakresem' : 'outside band'}
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
                {allocation.recommendedAction === 'DEPLOY_EXISTING_CASH'
                  ? (isPolish ? 'Dostępna gotówka' : 'Available cash')
                  : (isPolish ? 'Kolejna wpłata' : 'Next contribution')}
              </dt>
              <dd className="mt-1 font-medium text-zinc-100">
                {allocation.recommendedAssetClass && Number(allocation.recommendedContributionPln) > 0
                  ? allocation.recommendedAction === 'DEPLOY_EXISTING_CASH'
                    ? isPolish
                      ? `${formatCurrencyPln(allocation.recommendedContributionPln)} gotówki -> ${labelAssetClass(allocation.recommendedAssetClass)}`
                      : `${formatCurrencyPln(allocation.recommendedContributionPln)} cash -> ${labelAssetClass(allocation.recommendedAssetClass)}`
                    : `${formatCurrencyPln(allocation.recommendedContributionPln)} -> ${labelAssetClass(allocation.recommendedAssetClass)}`
                  : isPolish
                    ? 'Brak potrzeby rebalansowania przez wpłatę'
                    : 'No rebalance contribution needed'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">{isPolish ? 'Pełny rebalance' : 'Full rebalance'}</dt>
              <dd className="mt-1 font-medium text-zinc-100">
                {formatCurrencyPln(allocation.fullRebalanceBuyAmountPln)} / {formatCurrencyPln(allocation.fullRebalanceSellAmountPln)}
              </dd>
            </div>
          </dl>

          <Link to="/settings#targets" className="inline-flex text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100">
            {isPolish ? 'Otwórz alokację docelową' : 'Open target allocation'}
          </Link>
        </div>
      )}
    </div>
  )
}

export function DashboardDataQualityCard({
  isPolish,
  summary,
}: {
  isPolish: boolean
  summary: PortfolioDataQualitySummary | null | undefined
}) {
  if (!summary?.warningCount) {
    return null
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-amber-400">{isPolish ? 'Jakość danych' : 'Data quality'}</h3>
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
        {isPolish ? 'Otwórz szczegóły jakości danych' : 'Open data quality details'}
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
