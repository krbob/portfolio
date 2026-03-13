import { SectionCard } from './SectionCard'
import { usePortfolioOverview } from '../hooks/use-read-model'

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

function formatSignedCurrency(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }
  const amount = Number(value)
  const formatted = formatCurrency(value)
  if (amount > 0) {
    return `+${formatted}`
  }
  return formatted
}

export function PortfolioOverviewSection() {
  const overviewQuery = usePortfolioOverview()
  const data = overviewQuery.data

  return (
    <SectionCard
      eyebrow="Read model"
      title="Portfolio overview"
      description="Current valuation uses market data when available and falls back to book basis for positions that could not be priced."
    >
      <div className="overview-grid">
        <article className="overview-stat">
          <span>Total current value</span>
          <strong>{data ? formatCurrency(data.totalCurrentValuePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Total unrealized P/L</span>
          <strong className={data ? gainClassName(data.totalUnrealizedGainPln) : undefined}>
            {data ? formatSignedCurrency(data.totalUnrealizedGainPln) : '...'}
          </strong>
        </article>

        <article className="overview-stat">
          <span>Invested current value</span>
          <strong>{data ? formatCurrency(data.investedCurrentValuePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Cash balance</span>
          <strong>{data ? formatCurrency(data.cashBalancePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Valuation coverage</span>
          <strong>
            {data ? `${data.valuedHoldingCount}/${data.activeHoldingCount}` : '...'}
          </strong>
        </article>

        <article className="overview-stat">
          <span>Total issues</span>
          <strong>
            {data
              ? data.valuationIssueCount +
                data.missingFxTransactions +
                data.unsupportedCorrectionTransactions
              : '...'}
          </strong>
        </article>
      </div>

      {overviewQuery.isLoading && <p className="muted-copy">Loading portfolio overview...</p>}
      {overviewQuery.isError && <p className="form-error">{overviewQuery.error.message}</p>}
      {data && (
        <div className="overview-notes">
          <p>
            Current allocation: equities {formatCurrency(data.equityCurrentValuePln)}, bonds{' '}
            {formatCurrency(data.bondCurrentValuePln)}, cash {formatCurrency(data.cashCurrentValuePln)}.
          </p>
          <p>
            Book basis: total {formatCurrency(data.totalBookValuePln)}, invested{' '}
            {formatCurrency(data.investedBookValuePln)}, net contributions{' '}
            {formatCurrency(data.netContributionsPln)}.
          </p>
          <p>
            Valuation state {data.valuationState}. Unvalued holdings: {data.unvaluedHoldingCount}.
            Valuation issues: {data.valuationIssueCount}. Missing FX transactions:{' '}
            {data.missingFxTransactions}. Unsupported corrections:{' '}
            {data.unsupportedCorrectionTransactions}.
          </p>
        </div>
      )}
    </SectionCard>
  )
}

function gainClassName(value: string | null | undefined) {
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
