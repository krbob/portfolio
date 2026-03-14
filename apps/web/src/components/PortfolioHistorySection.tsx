import { useMemo, useState } from 'react'
import { SectionCard } from './SectionCard'
import { PortfolioAllocationChart } from './PortfolioAllocationChart'
import { PortfolioBenchmarkChart } from './PortfolioBenchmarkChart'
import { PortfolioValueChart } from './PortfolioValueChart'
import { usePortfolioDailyHistory } from '../hooks/use-read-model'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'

type HistoryUnit = 'PLN' | 'USD' | 'AU'
type HistoryPeriod = 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX'
type ValueSeriesKey =
  | 'totalCurrentValuePln'
  | 'totalCurrentValueUsd'
  | 'totalCurrentValueAu'
type ContributionSeriesKey =
  | 'netContributionsPln'
  | 'netContributionsUsd'
  | 'netContributionsAu'

const HISTORY_PERIODS: HistoryPeriod[] = ['YTD', '1Y', '3Y', '5Y', 'MAX']

function formatCurrency(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatPercent(value: string) {
  return `${Number(value).toFixed(2)}%`
}

function formatSignedCurrency(value: string) {
  const amount = Number(value)
  const formatted = formatCurrency(value)
  if (amount > 0) {
    return `+${formatted}`
  }
  return formatted
}

export function PortfolioHistorySection() {
  const [unit, setUnit] = useState<HistoryUnit>('PLN')
  const [period, setPeriod] = useState<HistoryPeriod>('MAX')
  const historyQuery = usePortfolioDailyHistory()
  const data = historyQuery.data
  const points = data?.points ?? []
  const filteredPoints = useMemo(() => filterPointsByPeriod(points, period), [period, points])
  const latest = filteredPoints.at(-1) ?? points.at(-1)
  const series = seriesForUnit(unit)
  const latestBenchmark = latest?.portfolioPerformanceIndex
  const gain =
    latest && latest[series.valueKey] != null && latest[series.contributionsKey] != null
      ? (Number(latest[series.valueKey]) - Number(latest[series.contributionsKey])).toFixed(unit === 'PLN' ? 2 : 8)
      : null

  return (
    <SectionCard
      eyebrow="History"
      title="Daily portfolio history"
      description="A rebuildable time series derived from transactions plus historical market data, with filtered views for PLN, USD and gold ounces, plus benchmark overlays indexed from the same starting point."
    >
      {historyQuery.isLoading && <p className="muted-copy">Loading daily history...</p>}
      {historyQuery.isError && <p className="form-error">{historyQuery.error.message}</p>}
      {data && points.length === 0 && <p className="muted-copy">No daily history yet.</p>}

      {data && latest && filteredPoints.length > 0 && (
        <>
          <div className="history-summary-grid">
            <article className="overview-stat">
              <span>Latest value</span>
              <strong>{formatSeriesValue(latest[series.valueKey], unit)}</strong>
            </article>
            <article className="overview-stat">
              <span>Net contributions</span>
              <strong>{formatSeriesValue(latest[series.contributionsKey], unit)}</strong>
            </article>
            <article className="overview-stat">
              <span>Portfolio gain</span>
              <strong className={gainClassName(gain)}>
                {gain ? formatSeriesDelta(gain, unit) : '...'}
              </strong>
            </article>
            <article className="overview-stat">
              <span>History coverage</span>
              <strong>
                {latest.valuedHoldingCount}/{latest.activeHoldingCount}
              </strong>
            </article>
            <article className="overview-stat">
              <span>Portfolio index</span>
              <strong>{formatIndexValue(latestBenchmark)}</strong>
            </article>
          </div>

          <div className="history-toolbar">
            <div className="history-pill-group" role="tablist" aria-label="History unit">
              {(['PLN', 'USD', 'AU'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === unit ? 'unit-pill unit-pill-active' : 'unit-pill'}
                  onClick={() => setUnit(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="history-pill-group" role="tablist" aria-label="History period">
              {HISTORY_PERIODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === period ? 'unit-pill unit-pill-active' : 'unit-pill'}
                  onClick={() => setPeriod(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-stack">
            <div className="history-chart-card">
              <PortfolioValueChart
                contributionsKey={series.contributionsKey}
                points={filteredPoints}
                unit={unit}
                valueKey={series.valueKey}
              />

              <div className="chart-legend">
                <span className="legend-item">
                  <i className="legend-swatch legend-swatch-primary" />
                  Portfolio value {series.label}
                </span>
                <span className="legend-item">
                  <i className="legend-swatch legend-swatch-secondary" />
                  Net contributions {series.label}
                </span>
                <span className="legend-range">
                  {filteredPoints[0]?.date} to {filteredPoints.at(-1)?.date}
                </span>
              </div>
            </div>

            <div className="history-chart-card">
              <PortfolioAllocationChart points={filteredPoints} />
            </div>

            <div className="history-chart-card">
              <PortfolioBenchmarkChart points={filteredPoints} />
            </div>
          </div>

          <div className="history-notes">
            <p>
              Latest allocation: equities {formatPercent(latest.equityAllocationPct)}, bonds{' '}
              {formatPercent(latest.bondAllocationPct)}, cash {formatPercent(latest.cashAllocationPct)}.
            </p>
            <p>
              History state {data.valuationState}. Instrument history issues: {data.instrumentHistoryIssueCount}.
              Reference series issues: {data.referenceSeriesIssueCount}. Missing FX transactions:{' '}
              {data.missingFxTransactions}. Unsupported corrections:{' '}
              {data.unsupportedCorrectionTransactions}.
            </p>
            <p>
              Benchmark series issues: {data.benchmarkSeriesIssueCount}. Latest indexed levels:
              portfolio {formatIndexValue(latest.portfolioPerformanceIndex)}, VWRA{' '}
              {formatIndexValue(latest.equityBenchmarkIndex)}, inflation{' '}
              {formatIndexValue(latest.inflationBenchmarkIndex)}, target mix{' '}
              {formatIndexValue(latest.targetMixBenchmarkIndex)}.
            </p>
          </div>
        </>
      )}
    </SectionCard>
  )
}

function filterPointsByPeriod(points: PortfolioDailyHistoryPoint[], period: HistoryPeriod) {
  if (period === 'MAX' || points.length === 0) {
    return points
  }

  const latestDate = new Date(points.at(-1)?.date ?? points[0].date)
  const cutoff = new Date(latestDate)

  if (period === 'YTD') {
    const cutoffString = `${latestDate.getUTCFullYear()}-01-01`
    return points.filter((point) => point.date >= cutoffString)
  }

  const months = period === '1Y' ? 12 : period === '3Y' ? 36 : 60
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  const cutoffString = cutoff.toISOString().slice(0, 10)
  return points.filter((point) => point.date >= cutoffString)
}

function gainClassName(value: string | null) {
  if (value == null) {
    return undefined
  }
  const amount = Number(value)
  if (amount > 0) {
    return 'value-positive'
  }
  if (amount < 0) {
    return 'value-negative'
  }
  return undefined
}

function seriesForUnit(unit: HistoryUnit): {
  valueKey: ValueSeriesKey
  contributionsKey: ContributionSeriesKey
  label: string
} {
  switch (unit) {
    case 'USD':
      return {
        valueKey: 'totalCurrentValueUsd',
        contributionsKey: 'netContributionsUsd',
        label: 'in USD',
      }
    case 'AU':
      return {
        valueKey: 'totalCurrentValueAu',
        contributionsKey: 'netContributionsAu',
        label: 'in gold',
      }
    default:
      return {
        valueKey: 'totalCurrentValuePln',
        contributionsKey: 'netContributionsPln',
        label: 'in PLN',
      }
  }
}

function formatSeriesValue(value: string | null | undefined, unit: HistoryUnit) {
  if (unit === 'PLN') {
    return formatCurrency(value)
  }
  if (value == null) {
    return 'Unavailable'
  }
  const digits = unit === 'USD' ? 2 : 6
  const suffix = unit === 'USD' ? 'USD' : 'AU'
  return `${Number(value).toFixed(digits)} ${suffix}`
}

function formatSeriesDelta(value: string, unit: HistoryUnit) {
  if (unit === 'PLN') {
    return formatSignedCurrency(value)
  }
  const amount = Number(value)
  const digits = unit === 'USD' ? 2 : 6
  const suffix = unit === 'USD' ? 'USD' : 'AU'
  const formatted = `${amount.toFixed(digits)} ${suffix}`
  return amount > 0 ? `+${formatted}` : formatted
}

function formatIndexValue(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }

  return Number(value).toFixed(2)
}
