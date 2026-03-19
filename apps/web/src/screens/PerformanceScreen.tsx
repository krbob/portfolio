import { PageIntro } from '../components/PageIntro'
import { PortfolioHistorySection } from '../components/PortfolioHistorySection'
import { PortfolioReturnsSection } from '../components/PortfolioReturnsSection'
import { usePortfolioDailyHistory, usePortfolioReturns } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent } from '../lib/format'

export function PerformanceScreen() {
  const returnsQuery = usePortfolioReturns()
  const historyQuery = usePortfolioDailyHistory()
  const latestPoint = historyQuery.data?.points.at(-1)
  const featuredPeriod = returnsQuery.data?.periods.find((period) => period.key === 'YTD') ?? returnsQuery.data?.periods[0]
  const featuredBenchmark = featuredPeriod?.benchmarks[0]

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Performance"
        title="Performance"
        description="Read history, returns and benchmarks through one coherent lens."
      />

      <section className="summary-grid">
        <article className="overview-stat">
          <span>Latest value</span>
          <strong>{latestPoint ? formatCurrencyPln(latestPoint.totalCurrentValuePln) : '...'}</strong>
        </article>

        <article className="overview-stat">
          <span>{featuredPeriod ? `${featuredPeriod.label} MWRR` : 'MWRR'}</span>
          <strong className={gainClassName(featuredPeriod?.nominalPln?.moneyWeightedReturn)}>
            {featuredPeriod ? formatPercent(featuredPeriod.nominalPln?.moneyWeightedReturn, { scale: 100, signed: true }) : '...'}
          </strong>
        </article>

        <article className="overview-stat">
          <span>{featuredPeriod ? `${featuredPeriod.label} TWR` : 'TWR'}</span>
          <strong className={gainClassName(featuredPeriod?.nominalPln?.timeWeightedReturn)}>
            {featuredPeriod ? formatPercent(featuredPeriod.nominalPln?.timeWeightedReturn, { scale: 100, signed: true }) : '...'}
          </strong>
        </article>

        <article className="overview-stat">
          <span>{featuredBenchmark ? `${featuredBenchmark.label} spread` : 'Coverage'}</span>
          <strong className={gainClassName(featuredBenchmark?.excessTimeWeightedReturn)}>
            {featuredBenchmark
              ? formatPercent(featuredBenchmark.excessTimeWeightedReturn, { scale: 100, signed: true })
              : latestPoint
                ? `${latestPoint.valuedHoldingCount}/${latestPoint.activeHoldingCount}`
                : '...'}
          </strong>
        </article>
      </section>

      <PortfolioHistorySection />
      <PortfolioReturnsSection />
    </div>
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
