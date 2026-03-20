import { useState } from 'react'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { badge, badgeVariants, filterInput, label as labelClass } from '../lib/styles'

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
  const { isPolish } = useI18n()
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL')
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('ALL')
  const eventsQuery = usePortfolioAuditEvents({
    limit,
    category: categoryFilter === 'ALL' ? undefined : categoryFilter,
  })

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
      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">
            {categoryFilter === 'ALL'
              ? (isPolish ? 'Zdarzenia w oknie' : 'Events in window')
              : isPolish
                ? `Zdarzenia ${categoryFilter}`
                : `${categoryFilter} events`}
          </span>
          <strong className="mt-1 block text-sm text-zinc-100">{events.length}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Błędy' : 'Failures'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{failureCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Wysoki wpływ' : 'High impact'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{highImpactCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Ostatni błąd' : 'Latest failure'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{latestFailure ? formatDateTime(latestFailure.occurredAt) : isPolish ? 'Brak' : 'None'}</strong>
        </article>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>{isPolish ? 'Kategoria' : 'Category'}</span>
          <select
            className={filterInput}
            aria-label={isPolish ? 'Kategoria' : 'Category'}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>{isPolish ? 'Wynik' : 'Outcome'}</span>
          <select
            className={filterInput}
            aria-label={isPolish ? 'Wynik' : 'Outcome'}
            value={outcomeFilter}
            onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}
          >
            {OUTCOME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>{isPolish ? 'Wpływ' : 'Impact'}</span>
          <select
            className={filterInput}
            aria-label={isPolish ? 'Wpływ' : 'Impact'}
            value={impactFilter}
            onChange={(event) => setImpactFilter(event.target.value as ImpactFilter)}
          >
            <option value="ALL">ALL</option>
            <option value="HIGH_IMPACT_ONLY">{isPolish ? 'TYLKO WYSOKI WPŁYW' : 'HIGH IMPACT ONLY'}</option>
          </select>
        </div>
      </div>

      {eventsQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie aktywności operacyjnej...' : 'Loading operational activity...'}</p>}
      {eventsQuery.isError && <p className="text-sm text-red-400">{eventsQuery.error.message}</p>}

      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length === 0 && (
        <p className="text-sm text-zinc-500">{isPolish ? 'Brak zdarzeń pasujących do bieżących filtrów.' : 'No operational audit events match the current filters.'}</p>
      )}

      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length > 0 && (
        <div className="space-y-3">
          {visibleEvents.map((event) => {
            const metadataSummary = buildMetadataSummary(event.metadata)
            const highImpact = isHighImpactAction(event.action)
            return (
              <article className="rounded-lg border border-zinc-800/50 p-4" key={event.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-sm text-zinc-100">{humanizeAction(event.action)}</strong>
                    <p className="text-sm text-zinc-500">
                      {event.category} · {formatDateTime(event.occurredAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {highImpact ? <span className={`${badge} ${badgeVariants.warning}`}>{isPolish ? 'WYSOKI WPŁYW' : 'HIGH IMPACT'}</span> : null}
                    <span
                      className={`${badge} ${event.outcome === 'FAILURE' ? badgeVariants.error : badgeVariants.success}`}
                    >
                      {isPolish ? (event.outcome === 'FAILURE' ? 'BŁĄD' : 'SUKCES') : event.outcome}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-sm text-zinc-300">{event.message}</p>
                {metadataSummary ? <p className="text-sm text-zinc-500">{metadataSummary}</p> : null}
                {event.entityId ? <p className="mt-1 text-xs font-mono text-zinc-600">{event.entityId}</p> : null}
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
