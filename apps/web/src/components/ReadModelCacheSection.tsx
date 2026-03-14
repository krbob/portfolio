import { SectionCard } from './SectionCard'
import { useReadModelCacheSnapshots } from '../hooks/use-read-model'

export function ReadModelCacheSection() {
  const cacheQuery = useReadModelCacheSnapshots()
  const snapshots = cacheQuery.data ?? []
  const totalPayloadBytes = snapshots.reduce((sum, snapshot) => sum + snapshot.payloadSizeBytes, 0)

  return (
    <SectionCard
      eyebrow="Read models"
      title="Cached snapshots"
      description="History and returns are cached as rebuildable read models, with metadata that explains when each snapshot was generated and why that generation happened."
    >
      <div className="backup-summary-grid">
        <article className="transfer-box">
          <span>Snapshots</span>
          <strong>{cacheQuery.data ? snapshots.length : '...'}</strong>
        </article>
        <article className="transfer-box">
          <span>Total payload</span>
          <strong>{cacheQuery.data ? formatBytes(totalPayloadBytes) : '...'}</strong>
        </article>
        <article className="transfer-box">
          <span>Latest generation</span>
          <strong>{snapshots[0]?.generatedAt ? formatTimestamp(snapshots[0].generatedAt) : 'n/a'}</strong>
        </article>
      </div>

      {cacheQuery.isLoading && <p className="muted-copy">Loading read-model cache snapshots...</p>}
      {cacheQuery.isError && <p className="form-error">{cacheQuery.error.message}</p>}
      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length === 0 && (
        <p className="muted-copy">No cached read models yet. Open history or returns to populate them.</p>
      )}

      {!cacheQuery.isLoading && !cacheQuery.isError && snapshots.length > 0 && (
        <div className="backup-list">
          {snapshots.map((snapshot) => (
            <article key={snapshot.cacheKey} className="backup-item">
              <div className="backup-item-header">
                <div>
                  <h4>{snapshot.modelName}</h4>
                  <p className="muted-copy">
                    {snapshot.cacheKey} · generated {formatTimestamp(snapshot.generatedAt)}
                  </p>
                </div>

                <span className="status-badge status-valued">{snapshot.invalidationReason}</span>
              </div>

              <dl className="backup-item-meta">
                <div>
                  <dt>Version</dt>
                  <dd>{snapshot.modelVersion}</dd>
                </div>
                <div>
                  <dt>Input window</dt>
                  <dd>{formatWindow(snapshot.inputsFrom, snapshot.inputsTo)}</dd>
                </div>
                <div>
                  <dt>Source updated</dt>
                  <dd>{snapshot.sourceUpdatedAt ? formatTimestamp(snapshot.sourceUpdatedAt) : 'n/a'}</dd>
                </div>
                <div>
                  <dt>Payload</dt>
                  <dd>{formatBytes(snapshot.payloadSizeBytes)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatWindow(from?: string | null, to?: string | null) {
  if (!from && !to) {
    return 'n/a'
  }
  return `${from ?? '...'} -> ${to ?? '...'}`
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}
