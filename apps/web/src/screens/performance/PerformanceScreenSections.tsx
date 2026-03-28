import type { BenchmarkComparison, PortfolioDailyHistoryPoint, PortfolioReturnPeriod } from '../../api/read-model'
import { AllocationTimeChart, BenchmarkChart, PortfolioValueChart } from '../../components/charts'
import { ErrorState, LoadingState, StatePanel, SegmentedControl } from '../../components/ui'
import { usePortfolioDailyHistory, usePortfolioReturns } from '../../hooks/use-read-model'
import { missingDataLabel } from '../../lib/availability'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln, formatYearMonth } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { translateBenchmarkLabel } from '../../lib/labels'
import { formatMessage, t } from '../../lib/messages'
import { card, td, tdRight, th, thRight, tr } from '../../lib/styles'

export type Period = 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX'
export type Unit = 'PLN' | 'USD' | 'AU'
export type Tab = 'charts' | 'returns'

export const PERIODS: Period[] = ['YTD', '1Y', '3Y', '5Y', 'MAX']
export const TABS = [
  { value: 'charts' as const, label: 'Charts' },
  { value: 'returns' as const, label: 'Returns' },
]

export function ChartsTab({
  historyQuery,
  points,
  period,
  onPeriodChange,
  unit,
  onUnitChange,
  series,
  benchmarkOrder,
  customBenchmarkLabel,
}: {
  historyQuery: ReturnType<typeof usePortfolioDailyHistory>
  points: PortfolioDailyHistoryPoint[]
  period: Period
  onPeriodChange: (period: Period) => void
  unit: Unit
  onUnitChange: (u: Unit) => void
  series: ReturnType<typeof seriesForUnit>
  benchmarkOrder: string[]
  customBenchmarkLabel?: string
}) {
  if (historyQuery.isLoading && points.length === 0) {
    return (
      <LoadingState
        title={t('performanceSections.loadingCharts')}
        description={t('performanceSections.loadingChartsDescription')}
      />
    )
  }

  if (historyQuery.isError && points.length === 0) {
    return (
      <ErrorState
        title={t('performanceSections.chartsErrorTitle')}
        description={t('performanceSections.chartsErrorDescription')}
        onRetry={() => void historyQuery.refetch()}
      />
    )
  }

  if (points.length === 0) {
    return (
      <StatePanel
        eyebrow={t('performanceSections.chartsEmptyEyebrow')}
        title={t('performanceSections.chartsEmptyTitle')}
        description={t('performanceSections.chartsEmptyDescription')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-400">{t('performanceSections.range')}</span>
            <SegmentedControl
              options={PERIODS.map((value) => ({ value, label: value }))}
              value={period}
              onChange={(value) => onPeriodChange(value as Period)}
              ariaLabel={t('performanceSections.chartPeriodLabel')}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-400">{t('performanceSections.unit')}</span>
            <SegmentedControl
              options={[
                { value: 'PLN', label: 'PLN' },
                { value: 'USD', label: 'USD' },
                { value: 'AU', label: t('performanceSections.gold') },
              ]}
              value={unit}
              onChange={(value) => onUnitChange(value as Unit)}
              ariaLabel={t('performanceSections.chartUnitLabel')}
            />
          </div>
        </div>
        <PortfolioValueChart
          points={points}
          valueKey={series.valueKey}
          contributionsKey={series.contributionsKey}
          unit={unit}
          height={360}
          title={formatMessage(t('performanceSections.chartTitle'), { unit })}
        />
      </div>

      <div className={card}>
        <AllocationTimeChart points={points} />
      </div>

      <div className={card}>
        <BenchmarkChart
          points={points}
          benchmarkOrder={benchmarkOrder}
          customBenchmarkLabel={customBenchmarkLabel}
        />
      </div>
    </div>
  )
}

export function ReturnsTab({
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
  const data = returnsQuery.data

  if (returnsQuery.isLoading) {
    return (
      <LoadingState
        title={t('performanceSections.loadingReturns')}
        description={t('performanceSections.loadingReturnsDescription')}
      />
    )
  }

  if (returnsQuery.isError) {
    return (
      <ErrorState
        title={t('performanceSections.returnsErrorTitle')}
        description={t('performanceSections.returnsErrorDescription')}
        onRetry={() => void returnsQuery.refetch()}
      />
    )
  }

  if (!data || data.periods.length === 0) {
    return (
      <StatePanel
        eyebrow={t('performanceSections.returnsEmptyEyebrow')}
        title={t('performanceSections.returnsEmptyTitle')}
        description={t('performanceSections.returnsEmptyDescription')}
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
          eyebrow={t('performanceSections.returnsEmptyEyebrow')}
          title={t('performanceSections.returnsUnavailableTitle')}
          description={t('performanceSections.returnsUnavailableDescription')}
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

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className={th}>{t('performanceSections.period')}</th>
              <th className={thRight}>PLN MWRR</th>
              <th className={thRight}>PLN TWR</th>
              <th className={thRight}>{t('performanceSections.realPln')}</th>
              <th className={thRight}>USD MWRR</th>
              <th className={thRight}>{t('performanceSections.annualized')}</th>
              <th className={thRight}>{t('performanceSections.days')}</th>
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
                      {t('performanceSections.clipped')}
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
      </div>
      {realCoverageUntil ? (
        <p className="text-xs text-zinc-500">
          {formatMessage(t('performanceSections.cpiCoverageNote'), { coverageUntil: realCoverageUntil })}
        </p>
      ) : null}

      {selectedBenchmarkPeriod ? (
        <div className={card}>
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">
                {t('performanceSections.benchmarks')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {formatMessage(t('performanceSections.benchmarkExcessDetail'), { label: selectedBenchmarkPeriod.label })}
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

export function filterByPeriod(points: PortfolioDailyHistoryPoint[], period: Period) {
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

export function seriesForUnit(unit: Unit) {
  switch (unit) {
    case 'USD':
      return { valueKey: 'totalCurrentValueUsd' as const, contributionsKey: 'netContributionsUsd' as const }
    case 'AU':
      return { valueKey: 'totalCurrentValueAu' as const, contributionsKey: 'netContributionsAu' as const }
    default:
      return { valueKey: 'totalCurrentValuePln' as const, contributionsKey: 'netContributionsPln' as const }
  }
}

export function findReturnPeriod(
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

export function formatReturn(
  value: string | null | undefined,
  available = true,
  isPolish = false,
) {
  if (!available) {
    return missingDataLabel(isPolish)
  }

  return formatPercent(value, { scale: 100, signed: true })
}

export function returnChange(
  value: string | null | undefined,
  available = true,
): 'positive' | 'negative' | 'neutral' | undefined {
  if (!available || value == null) return undefined
  const n = Number(value)
  if (n > 0) return 'positive'
  if (n < 0) return 'negative'
  return 'neutral'
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
        <p className="text-xs font-medium text-zinc-500">{translateBenchmarkLabel(benchmark.label)}</p>
        {benchmark.pinned ? (
          <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">
            {t('performanceSections.pinned')}
          </span>
        ) : null}
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${returnColor(benchmark.excessTimeWeightedReturn, returnsDisplayAvailable)}`}>
        {formatReturn(benchmark.excessTimeWeightedReturn, returnsDisplayAvailable, isPolish)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-600">
        {t('performanceSections.benchTwr')} {formatReturn(benchmark.nominalPln?.timeWeightedReturn, returnsDisplayAvailable, isPolish)}
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
  const breakdown = period.breakdown

  return (
    <div className={card}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">{t('performanceSections.valueBridge')}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {returnsDisplayAvailable
              ? formatMessage(t('performanceSections.bridgeAvailableDetail'), { label: period.label })
              : formatMessage(t('performanceSections.bridgeUnavailableDetail'), { label: period.label })}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-zinc-400">{t('performanceSections.period')}</span>
          <SegmentedControl
            options={PERIODS.map((value) => ({ value, label: value }))}
            value={selectedPeriod}
            onChange={(value) => onPeriodChange(value as Period)}
            ariaLabel={t('performanceSections.valueBridgePeriod')}
          />
        </div>
      </div>

      {breakdown ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-500 sm:text-sm">
            <span>{t('performanceSections.from')} {period.from}</span>
            <span>{t('performanceSections.until')} {period.until}</span>
            <span>{t('performanceSections.netChange')} {formatSignedCurrencyPln(breakdown.netChangePln)}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <BreakdownMetric
              label={t('performanceSections.opening')}
              value={formatCurrencyPln(breakdown.openingValuePln)}
              tone="neutral"
            />
            <BreakdownMetric
              label={t('performanceSections.depositsWithdrawals')}
              value={formatSignedCurrencyPln(breakdown.netExternalFlowsPln)}
              tone={numericTone(breakdown.netExternalFlowsPln)}
              subtitle={t('performanceSections.externalFlows')}
            />
            <BreakdownMetric
              label={t('performanceSections.interestCoupons')}
              value={formatSignedCurrencyPln(breakdown.interestAndCouponsPln)}
              tone={numericTone(breakdown.interestAndCouponsPln)}
            />
            <BreakdownMetric
              label={t('performanceSections.fees')}
              value={formatSignedCurrencyPln(breakdown.feesPln)}
              tone={numericTone(breakdown.feesPln)}
            />
            <BreakdownMetric
              label={t('performanceSections.taxes')}
              value={formatSignedCurrencyPln(breakdown.taxesPln)}
              tone={numericTone(breakdown.taxesPln)}
            />
            <BreakdownMetric
              label={t('performanceSections.marketFx')}
              value={formatSignedCurrencyPln(breakdown.marketAndFxPln)}
              tone={numericTone(breakdown.marketAndFxPln)}
              subtitle={t('performanceSections.marketFxSubtitle')}
            />
            <BreakdownMetric
              label={t('performanceSections.netInvestmentResult')}
              value={formatSignedCurrencyPln(breakdown.netInvestmentResultPln)}
              tone={numericTone(breakdown.netInvestmentResultPln)}
              subtitle={t('performanceSections.netInvestmentSubtitle')}
            />
            <BreakdownMetric
              label={t('performanceSections.closing')}
              value={formatCurrencyPln(breakdown.closingValuePln)}
              tone="neutral"
            />
          </div>
        </>
      ) : (
        <StatePanel
          eyebrow={t('performanceSections.bridgeEyebrow')}
          title={t('performanceSections.noBridgeTitle')}
          description={t('performanceSections.noBridgeDescription')}
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
