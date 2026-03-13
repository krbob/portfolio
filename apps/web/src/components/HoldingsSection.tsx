import { SectionCard } from './SectionCard'
import { usePortfolioHoldings } from '../hooks/use-read-model'

function formatCurrency(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function HoldingsSection() {
  const holdingsQuery = usePortfolioHoldings()

  return (
    <SectionCard
      eyebrow="Read model"
      title="Holdings"
      description="Positions are grouped by account and instrument using average-cost book basis."
    >
      <div className="entity-list">
        {holdingsQuery.isLoading && <p className="muted-copy">Loading holdings...</p>}
        {holdingsQuery.isError && <p className="form-error">{holdingsQuery.error.message}</p>}
        {holdingsQuery.data?.length === 0 && <p className="muted-copy">No holdings yet.</p>}
        {holdingsQuery.data?.map((holding) => (
          <article className="holding-item" key={`${holding.accountId}-${holding.instrumentId}`}>
            <div>
              <strong>{holding.instrumentName}</strong>
              <p>
                {holding.accountName} · {holding.kind} · {holding.assetClass}
              </p>
            </div>

            <dl className="holding-stats">
              <div>
                <dt>Quantity</dt>
                <dd>{holding.quantity}</dd>
              </div>
              <div>
                <dt>Avg cost</dt>
                <dd>{formatCurrency(holding.averageCostPerUnitPln)}</dd>
              </div>
              <div>
                <dt>Book value</dt>
                <dd>{formatCurrency(holding.bookValuePln)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </SectionCard>
  )
}
