import type { PortfolioHolding } from '../../api/read-model'
import { Card } from '../../components/ui'
import { formatCurrencyPln } from '../../lib/format'
import { t } from '../../lib/messages'

interface Props {
  holdings: PortfolioHolding[]
}

interface RankedHolding {
  instrumentName: string
  gain: number
}

function parseHoldingsWithGain(holdings: PortfolioHolding[]): RankedHolding[] {
  return holdings
    .filter((h) => h.unrealizedGainPln != null)
    .map((h) => ({
      instrumentName: h.instrumentName,
      gain: Number(h.unrealizedGainPln),
    }))
    .filter((h) => !Number.isNaN(h.gain))
}

function ContributorRow({ holding }: { holding: RankedHolding }) {
  const colorClass = holding.gain >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0 truncate text-sm text-zinc-300">{holding.instrumentName}</span>
      <span className={`shrink-0 text-sm font-medium ${colorClass}`}>{formatCurrencyPln(holding.gain)}</span>
    </li>
  )
}

export function PerformanceContributors({ holdings }: Props) {
  const ranked = parseHoldingsWithGain(holdings)

  if (ranked.length === 0) {
    return (
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          {t('performance.contributorsTitle')}
        </h2>
        <Card>
          <p className="text-sm text-zinc-500">{t('performance.noContributors')}</p>
        </Card>
      </div>
    )
  }

  const top3 = [...ranked].sort((a, b) => b.gain - a.gain).slice(0, 3)
  const bottom3 = [...ranked].sort((a, b) => a.gain - b.gain).slice(0, 3)

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        {t('performance.contributorsTitle')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('performance.topContributors')}
          </h3>
          <ul>
            {top3.map((h) => (
              <ContributorRow key={h.instrumentName} holding={h} />
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('performance.bottomContributors')}
          </h3>
          <ul>
            {bottom3.map((h) => (
              <ContributorRow key={h.instrumentName} holding={h} />
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
