import { SectionCard } from './SectionCard'
import { usePortfolioDailyHistory } from '../hooks/use-read-model'

const CHART_WIDTH = 860
const CHART_HEIGHT = 280
const CHART_PADDING_X = 24
const CHART_PADDING_Y = 18

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
  const historyQuery = usePortfolioDailyHistory()
  const data = historyQuery.data
  const points = data?.points ?? []
  const latest = points.at(-1)
  const gain = latest
    ? (Number(latest.totalCurrentValuePln) - Number(latest.netContributionsPln)).toFixed(2)
    : null

  return (
    <SectionCard
      eyebrow="History"
      title="Daily portfolio history"
      description="A rebuildable time series derived from transactions plus historical market data, currently focused on portfolio value and cumulative contributions in PLN."
    >
      {historyQuery.isLoading && <p className="muted-copy">Loading daily history...</p>}
      {historyQuery.isError && <p className="form-error">{historyQuery.error.message}</p>}
      {data && points.length === 0 && <p className="muted-copy">No daily history yet.</p>}

      {data && latest && points.length > 0 && (
        <>
          <div className="history-summary-grid">
            <article className="overview-stat">
              <span>Latest value</span>
              <strong>{formatCurrency(latest.totalCurrentValuePln)}</strong>
            </article>
            <article className="overview-stat">
              <span>Net contributions</span>
              <strong>{formatCurrency(latest.netContributionsPln)}</strong>
            </article>
            <article className="overview-stat">
              <span>Portfolio gain</span>
              <strong className={gainClassName(gain)}>{gain ? formatSignedCurrency(gain) : '...'}</strong>
            </article>
            <article className="overview-stat">
              <span>History coverage</span>
              <strong>
                {latest.valuedHoldingCount}/{latest.activeHoldingCount}
              </strong>
            </article>
          </div>

          <div className="history-chart-card">
            <svg
              className="history-chart"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label="Portfolio value and contributions history"
            >
              <HistoryGrid />
              <path d={buildSeriesPath(points, 'netContributionsPln')} className="chart-line chart-line-secondary" />
              <path d={buildSeriesPath(points, 'totalCurrentValuePln')} className="chart-line chart-line-primary" />
            </svg>

            <div className="chart-legend">
              <span className="legend-item">
                <i className="legend-swatch legend-swatch-primary" />
                Portfolio value
              </span>
              <span className="legend-item">
                <i className="legend-swatch legend-swatch-secondary" />
                Net contributions
              </span>
              <span className="legend-range">
                {data.from} to {data.until}
              </span>
            </div>
          </div>

          <div className="history-notes">
            <p>
              Latest allocation: equities {formatPercent(latest.equityAllocationPct)}, bonds{' '}
              {formatPercent(latest.bondAllocationPct)}, cash {formatPercent(latest.cashAllocationPct)}.
            </p>
            <p>
              History state {data.valuationState}. Instrument history issues: {data.instrumentHistoryIssueCount}.
              Missing FX transactions: {data.missingFxTransactions}. Unsupported corrections:{' '}
              {data.unsupportedCorrectionTransactions}.
            </p>
          </div>
        </>
      )}
    </SectionCard>
  )
}

function buildSeriesPath(
  points: Array<{ totalCurrentValuePln: string; netContributionsPln: string }>,
  key: 'totalCurrentValuePln' | 'netContributionsPln',
) {
  if (points.length === 0) {
    return ''
  }

  const values = points.flatMap((point) => [
    Number(point.totalCurrentValuePln),
    Number(point.netContributionsPln),
  ])
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = maxValue - minValue || 1
  const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2
  const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2

  return points
    .map((point, index) => {
      const x =
        CHART_PADDING_X + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth)
      const y =
        CHART_HEIGHT -
        CHART_PADDING_Y -
        ((Number(point[key]) - minValue) / range) * innerHeight
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function HistoryGrid() {
  const lines = 4

  return (
    <g className="chart-grid">
      {Array.from({ length: lines + 1 }).map((_, index) => {
        const y =
          CHART_PADDING_Y +
          (index / lines) * (CHART_HEIGHT - CHART_PADDING_Y * 2)

        return (
          <line
            key={index}
            x1={CHART_PADDING_X}
            x2={CHART_WIDTH - CHART_PADDING_X}
            y1={y}
            y2={y}
          />
        )
      })}
    </g>
  )
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
