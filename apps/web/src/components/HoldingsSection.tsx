import { SectionCard } from './SectionCard'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { formatCurrencyPln, formatSignedCurrencyPln } from '../lib/format'

export function HoldingsSection() {
  const holdingsQuery = usePortfolioHoldings()

  return (
    <SectionCard
      eyebrow="Read model"
      title="Holdings"
      description="Positions are grouped by account and instrument, with current value shown when market data was available."
    >
      <div className="entity-list">
        {holdingsQuery.isLoading && <p className="muted-copy">Loading holdings...</p>}
        {holdingsQuery.isError && <p className="form-error">{holdingsQuery.error.message}</p>}
        {holdingsQuery.data?.length === 0 && <p className="muted-copy">No holdings yet.</p>}
        {holdingsQuery.data?.map((holding) => {
          const valuationStatus = holding.valuationStatus ?? 'UNAVAILABLE'

          return (
            <article className="holding-item" key={`${holding.accountId}-${holding.instrumentId}`}>
              <div>
                <div className="holding-header">
                  <strong>{holding.instrumentName}</strong>
                  <span className={`status-badge status-${valuationStatus.toLowerCase()}`}>
                    {valuationStatus}
                  </span>
                </div>
                <p>
                  {holding.accountName} · {holding.kind} · {holding.assetClass} · {holding.transactionCount}{' '}
                  tx
                </p>
                {holding.valuedAt && <p className="holding-note">Valued at {holding.valuedAt}.</p>}
                {holding.valuationIssue && <p className="holding-note">{holding.valuationIssue}</p>}
              </div>

              <dl className="holding-stats">
                <div>
                  <dt>Quantity</dt>
                  <dd>{holding.quantity}</dd>
                </div>
                <div>
                  <dt>Avg cost</dt>
                  <dd>{formatCurrencyPln(holding.averageCostPerUnitPln)}</dd>
                </div>
                <div>
                  <dt>Current price</dt>
                  <dd>{formatCurrencyPln(holding.currentPricePln)}</dd>
                </div>
                <div>
                  <dt>Book value</dt>
                  <dd>{formatCurrencyPln(holding.bookValuePln)}</dd>
                </div>
                <div>
                  <dt>Current value</dt>
                  <dd>{formatCurrencyPln(holding.currentValuePln)}</dd>
                </div>
                <div>
                  <dt>Unrealized P/L</dt>
                  <dd className={gainClassName(holding.unrealizedGainPln)}>
                    {formatSignedCurrencyPln(holding.unrealizedGainPln)}
                  </dd>
                </div>
              </dl>
            </article>
          )
        })}
      </div>
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
