import { SectionCard } from './SectionCard'
import { usePortfolioOverview } from '../hooks/use-read-model'

function formatCurrency(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function PortfolioOverviewSection() {
  const overviewQuery = usePortfolioOverview()
  const data = overviewQuery.data

  return (
    <SectionCard
      eyebrow="Read model"
      title="Portfolio overview"
      description="Current read model is book-only: cash plus average-cost holdings derived from transactions."
    >
      <div className="overview-grid">
        <article className="overview-stat">
          <span>Total book value</span>
          <strong>{data ? formatCurrency(data.totalBookValuePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Invested book value</span>
          <strong>{data ? formatCurrency(data.investedBookValuePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Cash balance</span>
          <strong>{data ? formatCurrency(data.cashBalancePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Net contributions</span>
          <strong>{data ? formatCurrency(data.netContributionsPln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Active holdings</span>
          <strong>{data?.activeHoldingCount ?? '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>Read model issues</span>
          <strong>
            {data ? data.missingFxTransactions + data.unsupportedCorrectionTransactions : '...'}
          </strong>
        </article>
      </div>

      {overviewQuery.isLoading && <p className="muted-copy">Loading portfolio overview...</p>}
      {overviewQuery.isError && <p className="form-error">{overviewQuery.error.message}</p>}
      {data && (
        <div className="overview-notes">
          <p>
            Allocation by book basis: equities {formatCurrency(data.equityBookValuePln)}, bonds{' '}
            {formatCurrency(data.bondBookValuePln)}, cash {formatCurrency(data.cashBookValuePln)}.
          </p>
          <p>
            Valuation state {data.valuationState}. Missing FX transactions: {data.missingFxTransactions}.
            Unsupported corrections: {data.unsupportedCorrectionTransactions}.
          </p>
        </div>
      )}
    </SectionCard>
  )
}
