import { useReadModelCacheSnapshots } from '../hooks/use-read-model'
import { Card, SectionHeader } from './ui'
import { formatBytes, formatDateTime } from '../lib/format'
import { badge, badgeVariants } from '../lib/styles'

export function ReadModelCacheSection() {
  const cacheQuery = useReadModelCacheSnapshots()
  const snapshots = cacheQuery.data ?? []
  const totalPayloadBytes = snapshots.reduce((sum, snapshot) => sum + snapshot.payloadSizeBytes, 0)

  return (
    <Card>
      <SectionHeader
        eyebrow="Read models"
        title="Cached snapshots"
        description="History and returns are cached as rebuildable read models, with metadata that explains when each snapshot was generated and why that generation happened."
      />

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-3">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Snapshots</span>
          <strong className="mt-1 block text-sm text-zinc-100">{cacheQuery.data ? snapshots.length : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Total payload</span>
          <strong className="mt-1 block text-sm text-zinc-100">{cacheQuery.data ? formatBytes(totalPayloadBytes) : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Latest generation</span>
          <strong className="mt-1 block text-sm text-zinc-100">{snapshots[0]?.generatedAt ? formatDateTime(snapshots[0].generatedAt) : 'n/a'}</strong>
        </article>
      </div>

      {cacheQuery.isLoading && <p className="text-sm text-zinc-500">Loading read-model cache snapshots...</p>}
      {cacheQuery.isError && <p className="text-sm text-red-400">{cacheQuery.error.message}</p>}
      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length === 0 && (
        <p className="text-sm text-zinc-500">No cached read models yet. Open history or returns to populate them.</p>
      )}

      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length > 0 && (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <article key={snapshot.cacheKey} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{snapshot.modelName}</h4>
                  <p className="text-sm text-zinc-500">
                    {snapshot.cacheKey} · generated {formatDateTime(snapshot.generatedAt)}
                  </p>
                </div>

                <span className={`${badge} ${badgeVariants.success}`}>{snapshot.invalidationReason}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                <div>
                  <dt className="text-zinc-500">Version</dt>
                  <dd className="text-zinc-100">{snapshot.modelVersion}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Input window</dt>
                  <dd className="text-zinc-100">{formatWindow(snapshot.inputsFrom, snapshot.inputsTo)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Source updated</dt>
                  <dd className="text-zinc-100">{snapshot.sourceUpdatedAt ? formatDateTime(snapshot.sourceUpdatedAt) : 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Payload</dt>
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
