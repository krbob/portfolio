import { useState } from 'react'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatDateTime } from '../lib/format'

const CATEGORY_OPTIONS = [
  'ALL',
  'IMPORTS',
  'BACKUPS',
  'TRANSACTIONS',
  'ACCOUNTS',
  'INSTRUMENTS',
  'TARGETS',
  'SYSTEM',
] as const

const OUTCOME_OPTIONS = ['ALL', 'SUCCESS', 'FAILURE'] as const
const IMPACT_OPTIONS = ['ALL', 'HIGH_IMPACT_ONLY'] as const

type CategoryFilter = typeof CATEGORY_OPTIONS[number]
type OutcomeFilter = typeof OUTCOME_OPTIONS[number]
type ImpactFilter = typeof IMPACT_OPTIONS[number]

interface OperationalAuditPanelProps {
  limit?: number
}

export function OperationalAuditPanel({ limit = 30 }: OperationalAuditPanelProps) {
  const eventsQuery = usePortfolioAuditEvents({ limit })
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL')
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('ALL')

  const events = eventsQuery.data ?? []
  const visibleEvents = events.filter((event) => {
    if (categoryFilter !== 'ALL' && event.category !== categoryFilter) {
      return false
    }

    if (outcomeFilter !== 'ALL' && event.outcome !== outcomeFilter) {
      return false
    }

    if (impactFilter === 'HIGH_IMPACT_ONLY' && !isHighImpactAction(event.action)) {
      return false
    }

    return true
  })

  const failureCount = events.filter((event) => event.outcome === 'FAILURE').length
  const highImpactCount = events.filter((event) => isHighImpactAction(event.action)).length
  const latestFailure = events.find((event) => event.outcome === 'FAILURE') ?? null

  return (
    <>
      <div className="summary-grid operational-audit-summary">
        <article className="overview-stat">
          <span>Events in window</span>
          <strong>{events.length}</strong>
        </article>
        <article className="overview-stat">
          <span>Failures</span>
          <strong>{failureCount}</strong>
        </article>
        <article className="overview-stat">
          <span>High impact</span>
          <strong>{highImpactCount}</strong>
        </article>
        <article className="overview-stat">
          <span>Latest failure</span>
          <strong>{latestFailure ? formatDateTime(latestFailure.occurredAt) : 'None'}</strong>
        </article>
      </div>

      <div className="backup-toolbar operational-audit-toolbar">
        <label className="journal-filter">
          <span>Category</span>
          <select
            aria-label="Category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="journal-filter">
          <span>Outcome</span>
          <select
            aria-label="Outcome"
            value={outcomeFilter}
            onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}
          >
            {OUTCOME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="journal-filter">
          <span>Impact</span>
          <select
            aria-label="Impact"
            value={impactFilter}
            onChange={(event) => setImpactFilter(event.target.value as ImpactFilter)}
          >
            <option value="ALL">ALL</option>
            <option value="HIGH_IMPACT_ONLY">HIGH IMPACT ONLY</option>
          </select>
        </label>
      </div>

      {eventsQuery.isLoading && <p className="muted-copy">Loading operational activity...</p>}
      {eventsQuery.isError && <p className="form-error">{eventsQuery.error.message}</p>}

      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length === 0 && (
        <p className="muted-copy">No operational audit events match the current filters.</p>
      )}

      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length > 0 && (
        <div className="audit-feed">
          {visibleEvents.map((event) => {
            const metadataSummary = buildMetadataSummary(event.metadata)
            const highImpact = isHighImpactAction(event.action)
            return (
              <article className="audit-event" key={event.id}>
                <div className="audit-event-header">
                  <div>
                    <strong>{humanizeAction(event.action)}</strong>
                    <p>
                      {event.category} · {formatDateTime(event.occurredAt)}
                    </p>
                  </div>
                  <div className="audit-event-tags">
                    {highImpact ? <span className="status-badge status-underweight">HIGH IMPACT</span> : null}
                    <span
                      className={`status-badge ${event.outcome === 'FAILURE' ? 'status-unavailable' : 'status-valued'}`}
                    >
                      {event.outcome}
                    </span>
                  </div>
                </div>

                <p>{event.message}</p>
                {metadataSummary ? <p className="muted-copy">{metadataSummary}</p> : null}
                {event.entityId ? <p className="audit-event-entity">{event.entityId}</p> : null}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

function humanizeAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function isHighImpactAction(action: string) {
  return ['DELETED', 'RESTORED', 'IMPORTED', 'PRUNED', 'FAILED'].some((marker) => action.includes(marker))
}

function buildMetadataSummary(metadata: Record<string, string>) {
  const parts: string[] = []

  if (metadata.mode) {
    parts.push(`mode ${metadata.mode}`)
  }

  if (metadata.trigger) {
    parts.push(`trigger ${metadata.trigger}`)
  }

  if (metadata.sourceLabel) {
    parts.push(metadata.sourceLabel)
  }

  if (metadata.sourceFileName) {
    parts.push(metadata.sourceFileName)
  }

  if (metadata.profileName) {
    parts.push(`profile ${metadata.profileName}`)
  }

  if (metadata.createdCount && metadata.createdCount !== '0') {
    parts.push(`created ${metadata.createdCount}`)
  }

  if (metadata.skippedDuplicateCount && metadata.skippedDuplicateCount !== '0') {
    parts.push(`skipped ${metadata.skippedDuplicateCount}`)
  }

  if (metadata.invalidRowCount && metadata.invalidRowCount !== '0') {
    parts.push(`invalid ${metadata.invalidRowCount}`)
  }

  if (metadata.transactionCount && metadata.transactionCount !== '0') {
    parts.push(`transactions ${metadata.transactionCount}`)
  }

  if (metadata.retentionCount && metadata.retentionCount !== '0') {
    parts.push(`retention ${metadata.retentionCount}`)
  }

  if (metadata.safetyBackupFileName && metadata.safetyBackupFileName !== 'none') {
    parts.push(`safety backup ${metadata.safetyBackupFileName}`)
  }

  if (metadata.error) {
    parts.push(metadata.error)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}
