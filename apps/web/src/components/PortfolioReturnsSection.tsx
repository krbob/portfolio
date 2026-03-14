import { SectionCard } from './SectionCard'
import { usePortfolioReturns } from '../hooks/use-read-model'
import type { ReturnMetric } from '../api/read-model'

function formatPercent(value: string | null | undefined) {
  if (value == null) {
    return 'Unavailable'
  }

  return `${(Number(value) * 100).toFixed(2)}%`
}

export function PortfolioReturnsSection() {
  const returnsQuery = usePortfolioReturns()
  const data = returnsQuery.data

  return (
    <SectionCard
      eyebrow="Returns"
      title="Portfolio returns"
      description="Each period now exposes both money-weighted return and time-weighted return, so you can separate personal cash-flow timing from strategy performance."
    >
      {returnsQuery.isLoading && <p className="muted-copy">Loading return summary...</p>}
      {returnsQuery.isError && <p className="form-error">{returnsQuery.error.message}</p>}
      {data && data.periods.length === 0 && <p className="muted-copy">No return periods yet.</p>}

      {data && data.periods.length > 0 && (
        <>
          <div className="returns-grid">
            {data.periods.map((period) => (
              <article key={period.key} className="returns-card">
                <header className="returns-card-header">
                  <div>
                    <p className="returns-card-label">{period.label}</p>
                    <strong>{period.from} to {period.until}</strong>
                  </div>
                  {period.clippedToInception && (
                    <span className="status-badge status-unsupported">Clipped to inception</span>
                  )}
                </header>

                <div className="returns-stat-grid">
                  <ReturnStat
                    label="PLN MWRR"
                    metric={period.nominalPln}
                    valueKey="moneyWeightedReturn"
                  />
                  <ReturnStat
                    label="PLN TWR"
                    metric={period.nominalPln}
                    valueKey="timeWeightedReturn"
                  />
                  <ReturnStat
                    label="Real PLN MWRR"
                    metric={period.realPln}
                    valueKey="moneyWeightedReturn"
                  />
                  <ReturnStat
                    label="USD MWRR"
                    metric={period.nominalUsd}
                    valueKey="moneyWeightedReturn"
                  />
                  <ReturnStat
                    label="Real PLN TWR"
                    metric={period.realPln}
                    valueKey="timeWeightedReturn"
                  />
                  <ReturnStat
                    label="USD TWR"
                    metric={period.nominalUsd}
                    valueKey="timeWeightedReturn"
                  />
                </div>

                <p className="returns-note">
                  Requested from {period.requestedFrom}. Effective span {period.dayCount} days.
                  {period.nominalPln?.annualizedMoneyWeightedReturn &&
                    ` Annualized PLN MWRR ${formatPercent(period.nominalPln.annualizedMoneyWeightedReturn)}.`}
                  {period.nominalPln?.annualizedTimeWeightedReturn &&
                    ` Annualized PLN TWR ${formatPercent(period.nominalPln.annualizedTimeWeightedReturn)}.`}
                  {period.inflationMultiplier &&
                    ` Inflation window ${period.inflationFrom} to ${period.inflationUntil}, multiplier ${period.inflationMultiplier}.`}
                </p>
              </article>
            ))}
          </div>

          <div className="overview-notes">
            <p>
              `MWRR` treats only `DEPOSIT` and `WITHDRAWAL` as external cash flows. `TWR` neutralizes
              those flows and focuses on the portfolio path itself. Buys, sells, fees, taxes and interest
              stay inside the portfolio and are reflected in the valuation path.
            </p>
          </div>
        </>
      )}
    </SectionCard>
  )
}

function ReturnStat({
  label,
  metric,
  valueKey,
}: {
  label: string
  metric: ReturnMetric | null | undefined
  valueKey: keyof ReturnMetric
}) {
  const value = metric?.[valueKey]

  return (
    <article className="overview-stat">
      <span>{label}</span>
      <strong className={gainClassName(value)}>{formatPercent(value)}</strong>
    </article>
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
