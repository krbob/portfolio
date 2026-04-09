import { Link } from 'react-router-dom'
import { Card, FadeIn } from './ui'
import type { StaleMarketDataAlert as StaleMarketDataAlertModel } from '../lib/stale-market-data-alert'
import { formatDateTime } from '../lib/format'
import { t } from '../lib/messages'
import { badge, badgeVariants, btnGhost } from '../lib/styles'

export function StaleMarketDataAlert({ alert }: { alert: StaleMarketDataAlertModel | null }) {
  if (!alert) {
    return null
  }

  return (
    <FadeIn>
      <Card className="border-sky-500/30 bg-sky-500/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${badge} ${badgeVariants.info}`}>{t('staleAlert.badge')}</span>
              <strong className="text-sm text-zinc-100">{alert.title}</strong>
            </div>
            <p className="mt-2 text-sm text-zinc-300">{alert.message}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/system" className={btnGhost}>
              {t('staleAlert.openDataQuality')}
            </Link>
            <Link to="/system?tab=market-data" className={btnGhost}>
              {t('staleAlert.openMarketData')}
            </Link>
            <Link to="/system" className={btnGhost}>
              {t('staleAlert.openHealth')}
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Metric
            label={t('staleAlert.valuationCoverage')}
            value={alert.valuationCoverageLabel}
          />
          <Metric
            label={t('staleAlert.latestSnapshot')}
            value={alert.latestSnapshotAt ? formatDateTime(alert.latestSnapshotAt) : t('common.noData')}
          />
          <Metric
            label={t('staleAlert.primaryUpstream')}
            value={alert.upstreamLabel ?? t('common.none')}
          />
        </div>
      </Card>
    </FadeIn>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-sky-500/10 bg-zinc-950/40 p-3">
      <span className="text-xs text-zinc-500">{label}</span>
      <strong className="mt-1 block text-sm text-zinc-100">{value}</strong>
    </article>
  )
}
