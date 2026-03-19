import { useState } from 'react'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatDateTime } from '../lib/format'

interface ImportAuditPanelProps {
  title: string
  description: string
  limit?: number
}

export function ImportAuditPanel({
  title,
  description,
  limit = 12,
}: ImportAuditPanelProps) {
  const eventsQuery = usePortfolioAuditEvents({ limit, category: 'IMPORTS' })
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'SUCCESS' | 'FAILURE'>('ALL')

  const events = eventsQuery.data ?? []
  const latestEvent = events[0] ?? null
  const visibleEvents =
    outcomeFilter === 'ALL'
      ? events
      : events.filter((event) => event.outcome === outcomeFilter)

  return (
    <>
      <div className="section-header">
        <p className="eyebrow">Audit</p>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>

      {latestEvent && (
        <p className="muted-copy">
          Latest event: {latestEvent.message} · {formatDateTime(latestEvent.occurredAt)}
        </p>
      )}

      <div className="backup-toolbar">
        <label className="journal-filter">
          <span>Outcome</span>
          <select
            value={outcomeFilter}
            onChange={(event) =>
              setOutcomeFilter(event.target.value as 'ALL' | 'SUCCESS' | 'FAILURE')
            }
          >
            <option value="ALL">ALL</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </label>
      </div>

      {eventsQuery.isLoading && <p className="muted-copy">Loading import activity...</p>}
      {eventsQuery.isError && <p className="form-error">{eventsQuery.error.message}</p>}
      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length === 0 && (
        <p className="muted-copy">No import-related audit events yet.</p>
      )}
      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length > 0 && (
        <div className="audit-feed">
          {visibleEvents.map((event) => {
            const metadataSummary = buildImportMetadataSummary(event.metadata)
            return (
              <article className="audit-event" key={event.id}>
                <div className="audit-event-header">
                  <div>
                    <strong>{event.message}</strong>
                    <p>
                      {event.action} · {formatDateTime(event.occurredAt)}
                    </p>
                  </div>
                  <span
                    className={`status-badge ${event.outcome === 'FAILURE' ? 'status-unavailable' : 'status-valued'}`}
                  >
                    {event.outcome}
                  </span>
                </div>
                {metadataSummary && <p className="muted-copy">{metadataSummary}</p>}
                {event.entityId && <p className="audit-event-entity">{event.entityId}</p>}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

function buildImportMetadataSummary(metadata: Record<string, string>) {
  const parts: string[] = []

  if (metadata.sourceLabel) {
    parts.push(metadata.sourceLabel)
  }

  if (metadata.sourceFileName) {
    parts.push(metadata.sourceFileName)
  }

  if (metadata.profileName) {
    parts.push(`profile ${metadata.profileName}`)
  }

  if (metadata.createdCount) {
    parts.push(`created ${metadata.createdCount}`)
  }

  if (metadata.skippedDuplicateCount && metadata.skippedDuplicateCount !== '0') {
    parts.push(`skipped ${metadata.skippedDuplicateCount}`)
  }

  if (metadata.invalidRowCount && metadata.invalidRowCount !== '0') {
    parts.push(`invalid ${metadata.invalidRowCount}`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}
