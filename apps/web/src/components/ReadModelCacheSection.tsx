import { useState } from 'react'
import { activeNotApplicableLabel, notApplicableLabel } from '../lib/availability'
import { useReadModelCacheSnapshots } from '../hooks/use-read-model'
import { useInvalidateReadModelCache, useReadModelRefreshStatus, useRunReadModelRefresh } from '../hooks/use-write-model'
import { Card, SectionHeader } from './ui'
import { formatBytes, formatDateTime } from '../lib/format'
import { getActiveUiLanguage } from '../lib/i18n'
import { t } from '../lib/messages'
import { labelReadModelInvalidationReason } from '../lib/labels'
import { badge, badgeVariants, btnPrimary, btnSecondary } from '../lib/styles'

export function ReadModelCacheSection() {
  const isPolish = getActiveUiLanguage() === 'pl'
  const cacheQuery = useReadModelCacheSnapshots()
  const refreshStatusQuery = useReadModelRefreshStatus()
  const runRefreshMutation = useRunReadModelRefresh()
  const invalidateCacheMutation = useInvalidateReadModelCache()
  const snapshots = cacheQuery.data ?? []
  const totalPayloadBytes = snapshots.reduce((sum, snapshot) => sum + snapshot.payloadSizeBytes, 0)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleInvalidateClick() {
    setFeedback(null)

    try {
      const result = await invalidateCacheMutation.mutateAsync()
      setFeedback(
        isPolish
          ? `Wyczyszczono ${result.clearedSnapshotCount} migawek pamięci podręcznej. Historia i zwroty odbudują się przy następnym odczycie.`
          : `Cleared ${result.clearedSnapshotCount} cached snapshots. History and returns will rebuild on next access.`,
      )
    } catch {
      // handled by mutation error rendering below
    }
  }

  async function handleRunRefreshClick() {
    setFeedback(null)

    try {
      const result = await runRefreshMutation.mutateAsync()
      setFeedback(
        isPolish
          ? `Odświeżono ${result.refreshedModelCount} modeli: ${result.modelNames.join(', ')}.`
          : `Refreshed ${result.refreshedModelCount} models: ${result.modelNames.join(', ')}.`,
      )
    } catch {
      // handled by mutation error rendering below
    }
  }

  return (
    <Card>
      <SectionHeader
        eyebrow={t('cache.eyebrow')}
        title={t('cache.title')}
        description={t('cache.description')}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={handleRunRefreshClick}
              disabled={runRefreshMutation.isPending || refreshStatusQuery.data?.running}
            >
              {runRefreshMutation.isPending || refreshStatusQuery.data?.running
                ? t('cache.refreshing')
                : t('cache.refreshNow')}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={handleInvalidateClick}
              disabled={invalidateCacheMutation.isPending}
            >
              {invalidateCacheMutation.isPending
                ? t('cache.clearing')
                : t('cache.clearCache')}
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('cache.scheduler')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {refreshStatusQuery.data
              ? refreshStatusQuery.data.schedulerEnabled
                ? t('cache.schedulerEnabled')
                : t('cache.schedulerManual')
              : '...'}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('cache.interval')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {refreshStatusQuery.data ? `${refreshStatusQuery.data.intervalMinutes} min` : '...'}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('cache.snapshots')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{cacheQuery.data ? snapshots.length : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('cache.totalPayload')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{cacheQuery.data ? formatBytes(totalPayloadBytes) : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('cache.lastRefresh')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {refreshStatusQuery.data?.lastSuccessAt ? formatDateTime(refreshStatusQuery.data.lastSuccessAt) : notApplicableLabel(isPolish)}
          </strong>
        </article>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm text-zinc-500">
          {t('cache.models')}:{' '}
          {refreshStatusQuery.data?.modelNames.join(', ') ?? t('common.loading')}
        </p>
        <p className="text-sm text-zinc-500">
          {t('cache.lastTrigger')}:{' '}
          {refreshStatusQuery.data?.lastTrigger ?? t('common.none')}
          {refreshStatusQuery.data?.lastDurationMs != null ? ` · ${refreshStatusQuery.data.lastDurationMs} ms` : ''}
        </p>
        {refreshStatusQuery.data?.lastFailureMessage && (
          <p className="text-sm text-red-400">
            {t('cache.lastRefreshFailure')}:{' '}
            {refreshStatusQuery.data.lastFailureAt ? `${formatDateTime(refreshStatusQuery.data.lastFailureAt)}: ` : ''}
            {refreshStatusQuery.data.lastFailureMessage}
          </p>
        )}
      </div>

      {cacheQuery.isLoading && <p className="text-sm text-zinc-500">{t('cache.loadingSnapshots')}</p>}
      {refreshStatusQuery.isLoading && <p className="text-sm text-zinc-500">{t('cache.loadingRefreshStatus')}</p>}
      {cacheQuery.isError && <p className="text-sm text-red-400">{cacheQuery.error.message}</p>}
      {refreshStatusQuery.isError && <p className="text-sm text-red-400">{refreshStatusQuery.error.message}</p>}
      {feedback && <p className="mb-4 text-sm text-zinc-500">{feedback}</p>}
      {invalidateCacheMutation.error && (
        <p className="mb-4 text-sm text-red-400">{invalidateCacheMutation.error.message}</p>
      )}
      {runRefreshMutation.error && (
        <p className="mb-4 text-sm text-red-400">{runRefreshMutation.error.message}</p>
      )}
      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length === 0 && (
        <p className="text-sm text-zinc-500">{t('cache.emptySnapshots')}</p>
      )}

      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length > 0 && (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <article key={snapshot.cacheKey} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{snapshot.modelName}</h4>
                  <p className="text-sm text-zinc-500">
                    {snapshot.cacheKey} · {t('cache.generated')} {formatDateTime(snapshot.generatedAt)}
                  </p>
                </div>

                <span className={`${badge} ${badgeVariants.success}`}>{labelReadModelInvalidationReason(snapshot.invalidationReason)}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                <div>
                  <dt className="text-zinc-500">{t('cache.modelVersion')}</dt>
                  <dd className="text-zinc-100">{snapshot.modelVersion}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('cache.inputWindow')}</dt>
                  <dd className="text-zinc-100">{formatWindow(snapshot.inputsFrom, snapshot.inputsTo)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('cache.sourceUpdated')}</dt>
                  <dd className="text-zinc-100">{snapshot.sourceUpdatedAt ? formatDateTime(snapshot.sourceUpdatedAt) : notApplicableLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('cache.payload')}</dt>
                  <dd className="text-zinc-100">{formatBytes(snapshot.payloadSizeBytes)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </Card>
  )
}

function formatWindow(from?: string | null, to?: string | null) {
  if (!from && !to) {
    return activeNotApplicableLabel()
  }
  return `${from ?? '...'} -> ${to ?? '...'}`
}
