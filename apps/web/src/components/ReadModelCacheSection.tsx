import { useState } from 'react'
import { useReadModelCacheSnapshots } from '../hooks/use-read-model'
import { useInvalidateReadModelCache, useReadModelRefreshStatus, useRunReadModelRefresh } from '../hooks/use-write-model'
import { Card, SectionHeader } from './ui'
import { formatBytes, formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { badge, badgeVariants, btnPrimary, btnSecondary } from '../lib/styles'

export function ReadModelCacheSection() {
  const { isPolish } = useI18n()
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
          ? `Wyczyszczono ${result.clearedSnapshotCount} snapshotów cache. Historia i zwroty odbudują się przy następnym odczycie.`
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
        eyebrow={isPolish ? 'Read modele' : 'Read models'}
        title={isPolish ? 'Snapshoty cache' : 'Cached snapshots'}
        description={isPolish
          ? 'Historia i zwroty są cachowane jako odtwarzalne read modele, z metadanymi wyjaśniającymi kiedy i dlaczego dany snapshot powstał.'
          : 'History and returns are cached as rebuildable read models, with metadata that explains when each snapshot was generated and why that generation happened.'}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={handleRunRefreshClick}
              disabled={runRefreshMutation.isPending || refreshStatusQuery.data?.running}
            >
              {runRefreshMutation.isPending || refreshStatusQuery.data?.running
                ? isPolish
                  ? 'Odświeżanie...'
                  : 'Refreshing...'
                : isPolish
                  ? 'Odśwież teraz'
                  : 'Refresh now'}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={handleInvalidateClick}
              disabled={invalidateCacheMutation.isPending}
            >
              {invalidateCacheMutation.isPending
                ? isPolish
                  ? 'Czyszczenie...'
                  : 'Clearing...'
                : isPolish
                  ? 'Wyczyść cache'
                  : 'Clear cache'}
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Scheduler' : 'Scheduler'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {refreshStatusQuery.data
              ? refreshStatusQuery.data.schedulerEnabled
                ? isPolish
                  ? 'Włączony'
                  : 'Enabled'
                : isPolish
                  ? 'Tylko ręcznie'
                  : 'Manual only'
              : '...'}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Interwał' : 'Interval'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {refreshStatusQuery.data ? `${refreshStatusQuery.data.intervalMinutes} min` : '...'}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Snapshoty' : 'Snapshots'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{cacheQuery.data ? snapshots.length : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Łączny payload' : 'Total payload'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{cacheQuery.data ? formatBytes(totalPayloadBytes) : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Ostatnie odświeżenie' : 'Last refresh'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {refreshStatusQuery.data?.lastSuccessAt ? formatDateTime(refreshStatusQuery.data.lastSuccessAt) : 'n/a'}
          </strong>
        </article>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm text-zinc-500">
          {isPolish ? 'Modele' : 'Models'}:{' '}
          {refreshStatusQuery.data?.modelNames.join(', ') ?? (isPolish ? 'Ładowanie...' : 'Loading...')}
        </p>
        <p className="text-sm text-zinc-500">
          {isPolish ? 'Ostatni trigger' : 'Last trigger'}:{' '}
          {refreshStatusQuery.data?.lastTrigger ?? (isPolish ? 'brak' : 'n/a')}
          {refreshStatusQuery.data?.lastDurationMs != null ? ` · ${refreshStatusQuery.data.lastDurationMs} ms` : ''}
        </p>
        {refreshStatusQuery.data?.lastFailureMessage && (
          <p className="text-sm text-red-400">
            {isPolish ? 'Ostatni błąd odświeżania' : 'Last refresh failure'}:{' '}
            {refreshStatusQuery.data.lastFailureAt ? `${formatDateTime(refreshStatusQuery.data.lastFailureAt)}: ` : ''}
            {refreshStatusQuery.data.lastFailureMessage}
          </p>
        )}
      </div>

      {cacheQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie snapshotów cache read modeli...' : 'Loading read-model cache snapshots...'}</p>}
      {refreshStatusQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie statusu odświeżania...' : 'Loading refresh status...'}</p>}
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
        <p className="text-sm text-zinc-500">{isPolish ? 'Brak snapshotów read modeli. Otwórz historię lub zwroty, aby je wygenerować.' : 'No cached read models yet. Open history or returns to populate them.'}</p>
      )}

      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length > 0 && (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <article key={snapshot.cacheKey} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{snapshot.modelName}</h4>
                  <p className="text-sm text-zinc-500">
                    {snapshot.cacheKey} · {isPolish ? 'wygenerowano' : 'generated'} {formatDateTime(snapshot.generatedAt)}
                  </p>
                </div>

                <span className={`${badge} ${badgeVariants.success}`}>{snapshot.invalidationReason}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Wersja' : 'Version'}</dt>
                  <dd className="text-zinc-100">{snapshot.modelVersion}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Okno wejściowe' : 'Input window'}</dt>
                  <dd className="text-zinc-100">{formatWindow(snapshot.inputsFrom, snapshot.inputsTo)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Aktualizacja źródła' : 'Source updated'}</dt>
                  <dd className="text-zinc-100">{snapshot.sourceUpdatedAt ? formatDateTime(snapshot.sourceUpdatedAt) : 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Payload' : 'Payload'}</dt>
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
    return 'n/a'
  }
  return `${from ?? '...'} -> ${to ?? '...'}`
}
