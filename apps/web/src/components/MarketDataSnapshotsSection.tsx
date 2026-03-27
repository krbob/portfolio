import { notApplicableLabel } from '../lib/availability'
import { formatDateTime } from '../lib/format'
import { getActiveUiLanguage } from '../lib/i18n'
import { labelMarketDataSnapshotType } from '../lib/labels'
import { t } from '../lib/messages'
import { badge, badgeVariants } from '../lib/styles'
import { useMarketDataSnapshots } from '../hooks/use-read-model'
import { Card, SectionHeader } from './ui'

export function MarketDataSnapshotsSection() {
  const isPolish = getActiveUiLanguage() === 'pl'
  const snapshotsQuery = useMarketDataSnapshots()
  const snapshots = snapshotsQuery.data ?? []
  const latestCachedAt = snapshots[0]?.cachedAt
  const quoteCount = snapshots.filter((snapshot) => snapshot.snapshotType === 'QUOTE').length
  const seriesCount = snapshots.length - quoteCount

  return (
    <Card>
      <SectionHeader
        eyebrow={t('marketDataSnapshots.eyebrow')}
        title={t('marketDataSnapshots.title')}
        description={t('marketDataSnapshots.description')}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('marketDataSnapshots.snapshots')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{snapshotsQuery.data ? snapshots.length : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('marketDataSnapshots.latest')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {latestCachedAt ? formatDateTime(latestCachedAt) : notApplicableLabel(isPolish)}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('marketDataSnapshots.quotes')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{snapshotsQuery.data ? quoteCount : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('marketDataSnapshots.series')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{snapshotsQuery.data ? seriesCount : '...'}</strong>
        </article>
      </div>

      {snapshotsQuery.isLoading && <p className="text-sm text-zinc-500">{t('marketDataSnapshots.loading')}</p>}
      {snapshotsQuery.isError && <p className="text-sm text-red-400">{snapshotsQuery.error.message}</p>}

      {!snapshotsQuery.isLoading && !snapshotsQuery.isError && snapshots.length === 0 && (
        <p className="text-sm text-zinc-500">{t('marketDataSnapshots.empty')}</p>
      )}

      {!snapshotsQuery.isLoading && !snapshotsQuery.isError && snapshots.length > 0 && (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <article key={`${snapshot.snapshotType}:${snapshot.identity}:${snapshot.cachedAt}`} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{snapshot.identity}</h4>
                  <p className="text-sm text-zinc-500">
                    {t('marketDataSnapshots.cachedAt')} {formatDateTime(snapshot.cachedAt)}
                  </p>
                </div>
                <span className={`${badge} ${badgeVariants.info}`}>{labelMarketDataSnapshotType(snapshot.snapshotType)}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-3">
                <div>
                  <dt className="text-zinc-500">{t('marketDataSnapshots.coverage')}</dt>
                  <dd className="text-zinc-100">{formatCoverage(snapshot.sourceFrom, snapshot.sourceTo, isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('marketDataSnapshots.asOf')}</dt>
                  <dd className="text-zinc-100">{snapshot.sourceAsOf ?? notApplicableLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('marketDataSnapshots.points')}</dt>
                  <dd className="text-zinc-100">{snapshot.pointCount ?? notApplicableLabel(isPolish)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </Card>
  )
}

function formatCoverage(from: string | null | undefined, to: string | null | undefined, isPolish: boolean) {
  if (!from && !to) {
    return notApplicableLabel(isPolish)
  }
  if (from && to) {
    return from === to ? from : `${from} -> ${to}`
  }
  return from ?? to ?? notApplicableLabel(isPolish)
}
