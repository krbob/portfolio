import { useMemo, useState } from 'react'
import type { PortfolioDailyHistoryPoint, BenchmarkComparison, PortfolioReturnPeriod } from '../api/read-model'
import { PortfolioValueChart, AllocationTimeChart, BenchmarkChart } from '../components/charts'
import { PageHeader } from '../components/layout'
import { EmptyState, ErrorState, LoadingState, StatCard, StatePanel, TabBar, SegmentedControl } from '../components/ui'
import { usePortfolioDailyHistory, usePortfolioReturns } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln, formatYearMonth } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { card, th, thRight, td, tdRight, tr } from '../lib/styles'
import { isMarketValuationState } from '../lib/valuation'

type Period = 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX'
type Unit = 'PLN' | 'USD' | 'AU'
type Tab = 'charts' | 'returns'

const PERIODS: Period[] = ['YTD', '1Y', '3Y', '5Y', 'MAX']
const TABS = [
  { value: 'charts' as const, label: 'Charts' },
  { value: 'returns' as const, label: 'Returns' },
]

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

  if (historyQuery.isLoading && returnsQuery.isLoading && !hasHistory && !hasReturns) {
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
            ? 'Nie udało się wczytać modeli historii i zwrotów. Spróbuj ponownie albo sprawdź storage i gotowość danych rynkowych.'
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
          value={latest ? formatCurrencyPln(latest.totalCurrentValuePln) : (isPolish ? 'n/d' : 'N/A')}
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
  const { isPolish } = useI18n()

  if (historyQuery.isLoading && points.length === 0) {
    return (
      <LoadingState
        title={isPolish ? 'Ładowanie historii portfela' : 'Loading portfolio history'}
        description={isPolish
          ? 'Przygotowywanie historii wartości, wpłat i alokacji dla wybranego okresu.'
          : 'Preparing value, contributions and allocation history for the selected period.'}
      />
    )
  }

  if (historyQuery.isError && points.length === 0) {
    return (
      <ErrorState
        title={isPolish ? 'Historia niedostępna' : 'History unavailable'}
        description={isPolish
          ? 'Nie udało się wczytać historii dziennej dla przestrzeni wyników.'
          : 'Daily history could not load for the performance workspace.'}
        onRetry={() => void historyQuery.refetch()}
      />
    )
  }

  if (points.length === 0) {
    return (
      <StatePanel
        eyebrow={isPolish ? 'Historia' : 'History'}
        title={isPolish ? 'Brak danych historycznych' : 'No history data available'}
        description={isPolish
          ? 'Portfel nie zgromadził jeszcze wystarczającej liczby transakcji, aby narysować wykresy historyczne.'
          : 'Portfolio has not accumulated enough transactions to render the historical charts yet.'}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Portfolio Value Chart */}
      <div className={card}>
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-400">{isPolish ? 'Zakres' : 'Range'}</span>
            <SegmentedControl
              options={PERIODS.map((value) => ({ value, label: value }))}
              value={period}
              onChange={(value) => onPeriodChange(value as Period)}
              ariaLabel={isPolish ? 'Zakres wykresu wyników' : 'Performance chart period'}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-400">{isPolish ? 'Jednostka' : 'Unit'}</span>
            <SegmentedControl
              options={[
                { value: 'PLN', label: 'PLN' },
                { value: 'USD', label: 'USD' },
                { value: 'AU', label: isPolish ? 'Złoto' : 'Gold' },
              ]}
              value={unit}
              onChange={(value) => onUnitChange(value as Unit)}
              ariaLabel={isPolish ? 'Jednostka wykresu wyników' : 'Performance chart unit'}
            />
          </div>
        </div>
        <PortfolioValueChart
          points={points}
          valueKey={series.valueKey}
          contributionsKey={series.contributionsKey}
          unit={unit}
          height={360}
          title={isPolish ? `Wartość portfela (${unit})` : `Portfolio Value (${unit})`}
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

function ReturnsTab({
  returnsQuery,
  returnsDisplayAvailable,
  period,
  onPeriodChange,
}: {
  returnsQuery: ReturnType<typeof usePortfolioReturns>
  returnsDisplayAvailable: boolean
  period: Period
  onPeriodChange: (period: Period) => void
}) {
  const { isPolish } = useI18n()
  const data = returnsQuery.data

  if (returnsQuery.isLoading) {
    return (
      <LoadingState
        title={isPolish ? 'Ładowanie zwrotów' : 'Loading returns'}
        description={isPolish
          ? 'Wyliczanie MWRR, TWR i nadwyżki względem benchmarków.'
          : 'Calculating money-weighted, time-weighted and benchmark-relative returns.'}
      />
    )
  }

  if (returnsQuery.isError) {
    return (
      <ErrorState
        title={isPolish ? 'Zwroty niedostępne' : 'Returns unavailable'}
        description={isPolish
          ? 'Nie udało się wczytać wyliczeń zwrotów dla tego widoku.'
          : 'Return calculations could not be loaded for this workspace.'}
        onRetry={() => void returnsQuery.refetch()}
      />
    )
  }

  if (!data || data.periods.length === 0) {
    return (
      <StatePanel
        eyebrow={isPolish ? 'Zwroty' : 'Returns'}
        title={isPolish ? 'Brak wyliczonych okresów zwrotu' : 'No return periods calculated yet'}
        description={isPolish
          ? 'Okresy zwrotu pojawią się, gdy Portfolio będzie miało wystarczającą historię i przepływy zewnętrzne.'
          : 'Return periods appear after Portfolio has enough history and external cash-flow data to evaluate.'}
      />
    )
  }

  const realCoverageUntil = findRealPlnCoverageMonth(data.periods)
  const selectedPeriod = findSelectedReturnPeriod(data.periods, period)
  const selectedBenchmarkPeriod = selectedPeriod?.benchmarks.length ? selectedPeriod : null

  return (
    <div className="space-y-4">
      {!returnsDisplayAvailable ? (
        <StatePanel
          eyebrow={isPolish ? 'Zwroty' : 'Returns'}
          title={isPolish ? 'Zwroty są chwilowo niewiarygodne' : 'Returns are temporarily unavailable'}
          description={isPolish
            ? 'Historia portfela nie ma obecnie wystarczającego pokrycia wyceną rynkową, więc metryki zwrotu pokazujemy jako b/d zamiast udawać 0,00%.'
            : 'Portfolio history currently lacks enough market valuation coverage, so return metrics are shown as N/A instead of pretending they are 0.00%.'}
        />
      ) : null}

      {selectedPeriod ? (
        <ReturnsBreakdownCard
          period={selectedPeriod}
          returnsDisplayAvailable={returnsDisplayAvailable}
          selectedPeriod={period}
          onPeriodChange={onPeriodChange}
        />
      ) : null}

      {/* Returns table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className={th}>{isPolish ? 'Okres' : 'Period'}</th>
              <th className={thRight}>PLN MWRR</th>
              <th className={thRight}>PLN TWR</th>
              <th className={thRight}>{isPolish ? 'Realny PLN' : 'Real PLN'}</th>
              <th className={thRight}>USD MWRR</th>
              <th className={thRight}>{isPolish ? 'Rocznie' : 'Annualized'}</th>
              <th className={thRight}>{isPolish ? 'Dni' : 'Days'}</th>
            </tr>
          </thead>
          <tbody>
            {data.periods.map((p) => (
              <tr
                key={p.key}
                className={`${tr} ${p.key === selectedPeriod?.key ? 'bg-zinc-800/30' : p.key === 'MAX' ? 'bg-zinc-800/20' : ''}`}
              >
                <td className={`${td} font-medium text-zinc-200`}>
                  {p.label}
                  {p.clippedToInception && (
                    <span className="ml-1.5 text-xs text-zinc-600">
                      {isPolish ? '(ucięte do początku portfela)' : '(clipped)'}
                    </span>
                  )}
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalPln?.moneyWeightedReturn} available={returnsDisplayAvailable} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalPln?.timeWeightedReturn} available={returnsDisplayAvailable} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.realPln?.moneyWeightedReturn} available={returnsDisplayAvailable} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalUsd?.moneyWeightedReturn} available={returnsDisplayAvailable} />
                </td>
                <td className={tdRight}>
                  <ReturnValue value={p.nominalPln?.annualizedMoneyWeightedReturn} available={returnsDisplayAvailable} />
                </td>
                <td className={`${tdRight} text-zinc-500`}>{p.dayCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {realCoverageUntil ? (
        <p className="text-xs text-zinc-500">
          {isPolish
            ? `Realny PLN używa tylko pełnych miesięcy pokrytych CPI; bieżące pokrycie CPI do ${realCoverageUntil}.`
            : `Real PLN uses CPI-covered full months only; current CPI coverage through ${realCoverageUntil}.`}
        </p>
      ) : null}

      {/* Benchmark comparisons */}
      {selectedBenchmarkPeriod ? (
        <div className={card}>
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">
                {isPolish ? 'Benchmarki' : 'Benchmarks'}
              </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {isPolish
                      ? `Nadwyżka TWR względem wybranego okresu. Szczegóły poniżej dla ${selectedBenchmarkPeriod.label}.`
                      : `Time-weighted excess return versus the selected period. Details below for ${selectedBenchmarkPeriod.label}.`}
                  </p>
                </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {selectedBenchmarkPeriod.benchmarks.map((benchmark) => (
              <BenchmarkCard
                key={`${selectedBenchmarkPeriod.key}:${benchmark.key}`}
                benchmark={benchmark}
                returnsDisplayAvailable={returnsDisplayAvailable}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function BenchmarkCard({
  benchmark,
  returnsDisplayAvailable,
}: {
  benchmark: BenchmarkComparison
  returnsDisplayAvailable: boolean
}) {
  const { isPolish } = useI18n()
  return (
    <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500">{benchmark.label}</p>
        {benchmark.pinned ? (
          <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">
            {isPolish ? 'Przypięty' : 'Pinned'}
          </span>
        ) : null}
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${returnColor(benchmark.excessTimeWeightedReturn, returnsDisplayAvailable)}`}>
        {formatReturn(benchmark.excessTimeWeightedReturn, returnsDisplayAvailable, isPolish)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-600">
        {isPolish ? 'TWR benchmarku' : 'Bench TWR'} {formatReturn(benchmark.nominalPln?.timeWeightedReturn, returnsDisplayAvailable, isPolish)}
      </p>
    </div>
  )
}

function ReturnsBreakdownCard({
  period,
  returnsDisplayAvailable,
  selectedPeriod,
  onPeriodChange,
}: {
  period: PortfolioReturnPeriod
  returnsDisplayAvailable: boolean
  selectedPeriod: Period
  onPeriodChange: (period: Period) => void
}) {
  const { isPolish } = useI18n()
  const breakdown = period.breakdown

  return (
    <div className={card}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">{isPolish ? 'Most zmiany wartości' : 'Value-change bridge'}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {returnsDisplayAvailable
              ? (isPolish
                ? `Otwarcie, przepływy zewnętrzne, dochód, koszty i reszta przypisana do rynku + FX dla okresu ${period.label}.`
                : `Opening value, external flows, income, costs and the residual attributed to market + FX for ${period.label}.`)
              : (isPolish
                ? `Otwarcie i zamknięcie są dostępne, ale reszta nadal używa bieżącej podstawy wyceny dla okresu ${period.label}.`
                : `Opening and closing values are available, but the residual still follows the current valuation basis for ${period.label}.`)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-zinc-400">{isPolish ? 'Okres' : 'Period'}</span>
          <SegmentedControl
            options={PERIODS.map((value) => ({ value, label: value }))}
            value={selectedPeriod}
            onChange={(value) => onPeriodChange(value as Period)}
            ariaLabel={isPolish ? 'Okres mostu wyniku' : 'Value bridge period'}
          />
        </div>
      </div>

      {breakdown ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-500 sm:text-sm">
            <span>{isPolish ? 'Od' : 'From'} {period.from}</span>
            <span>{isPolish ? 'Do' : 'Until'} {period.until}</span>
            <span>{isPolish ? 'Zmiana netto' : 'Net change'} {formatSignedCurrencyPln(breakdown.netChangePln)}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <BreakdownMetric
              label={isPolish ? 'Otwarcie' : 'Opening value'}
              value={formatCurrencyPln(breakdown.openingValuePln)}
              tone="neutral"
            />
            <BreakdownMetric
              label={isPolish ? 'Wpłaty / wypłaty' : 'Deposits / withdrawals'}
              value={formatSignedCurrencyPln(breakdown.netExternalFlowsPln)}
              tone={numericTone(breakdown.netExternalFlowsPln)}
              subtitle={isPolish ? 'Przepływy zewnętrzne' : 'External cash flows'}
            />
            <BreakdownMetric
              label={isPolish ? 'Odsetki / kupony' : 'Interest / coupons'}
              value={formatSignedCurrencyPln(breakdown.interestAndCouponsPln)}
              tone={numericTone(breakdown.interestAndCouponsPln)}
            />
            <BreakdownMetric
              label={isPolish ? 'Opłaty' : 'Fees'}
              value={formatSignedCurrencyPln(breakdown.feesPln)}
              tone={numericTone(breakdown.feesPln)}
            />
            <BreakdownMetric
              label={isPolish ? 'Podatki' : 'Taxes'}
              value={formatSignedCurrencyPln(breakdown.taxesPln)}
              tone={numericTone(breakdown.taxesPln)}
            />
            <BreakdownMetric
              label={isPolish ? 'Rynek + FX' : 'Market + FX'}
              value={formatSignedCurrencyPln(breakdown.marketAndFxPln)}
              tone={numericTone(breakdown.marketAndFxPln)}
              subtitle={isPolish ? 'Reszta po przepływach i kosztach' : 'Residual after flows and costs'}
            />
            <BreakdownMetric
              label={isPolish ? 'Wynik netto' : 'Net investment result'}
              value={formatSignedCurrencyPln(breakdown.netInvestmentResultPln)}
              tone={numericTone(breakdown.netInvestmentResultPln)}
              subtitle={isPolish ? 'Bez wpłat i wypłat' : 'Excluding deposits and withdrawals'}
            />
            <BreakdownMetric
              label={isPolish ? 'Zamknięcie' : 'Closing value'}
              value={formatCurrencyPln(breakdown.closingValuePln)}
              tone="neutral"
            />
          </div>
        </>
      ) : (
        <StatePanel
          eyebrow={isPolish ? 'Most wyniku' : 'Value bridge'}
          title={isPolish ? 'Brak rozbicia dla tego okresu' : 'No bridge available for this period'}
          description={isPolish
            ? 'Nie udało się złożyć rozbicia przepływów i kosztów dla wybranego okresu.'
            : 'The app could not assemble a flow-and-cost bridge for the selected period.'}
        />
      )}
    </div>
  )
}

function BreakdownMetric({
  label,
  value,
  tone,
  subtitle,
}: {
  label: string
  value: string
  tone: 'positive' | 'negative' | 'neutral'
  subtitle?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-2 text-lg font-semibold tabular-nums ${
          tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-zinc-100'
        }`}
      >
        {value}
      </p>
      {subtitle ? <p className="mt-1 text-xs text-zinc-600">{subtitle}</p> : null}
    </div>
  )
}

function ReturnValue({
  value,
  available = true,
}: {
  value: string | null | undefined
  available?: boolean
}) {
  return (
    <span className={`font-medium ${returnColor(value, available)}`}>
      {formatReturn(value, available)}
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

function findSelectedReturnPeriod(periods: PortfolioReturnPeriod[], period: Period) {
  const selectedKey = periodToReturnKey(period)
  return periods.find((candidate) => candidate.key === selectedKey) ?? periods.find((candidate) => candidate.key === 'MAX') ?? periods[0] ?? null
}

function periodToReturnKey(period: Period): PortfolioReturnPeriod['key'] {
  switch (period) {
    case 'YTD':
      return 'YTD'
    case '1Y':
      return 'ONE_YEAR'
    case '3Y':
      return 'THREE_YEARS'
    case '5Y':
      return 'FIVE_YEARS'
    case 'MAX':
      return 'MAX'
  }
}

function numericTone(value: string | null | undefined): 'positive' | 'negative' | 'neutral' {
  if (value == null) {
    return 'neutral'
  }

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) {
    return 'neutral'
  }
  if (numericValue > 0) {
    return 'positive'
  }
  if (numericValue < 0) {
    return 'negative'
  }
  return 'neutral'
}

function formatReturn(
  value: string | null | undefined,
  available = true,
  isPolish = false,
) {
  if (!available) {
    return isPolish ? 'b/d' : 'N/A'
  }

  return formatPercent(value, { scale: 100, signed: true })
}

function returnChange(
  value: string | null | undefined,
  available = true,
): 'positive' | 'negative' | 'neutral' | undefined {
  if (!available || value == null) return undefined
  const n = Number(value)
  if (n > 0) return 'positive'
  if (n < 0) return 'negative'
  return 'neutral'
}

function returnColor(value: string | null | undefined, available = true) {
  if (!available || value == null) return 'text-zinc-500'
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
