import { useState } from 'react'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { buildAuditMetadataEntries, buildAuditMetadataSummary, formatAuditEventMessage, formatAuditEventTitle, isHighImpactAuditAction } from '../lib/audit-copy'
import { labelAuditCategory } from '../lib/labels'
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

    if (impactFilter === 'HIGH_IMPACT_ONLY' && !isHighImpactAuditAction(event.action)) {
      return false
    }

    return true
  })

  const failureCount = events.filter((event) => event.outcome === 'FAILURE').length
  const highImpactCount = events.filter((event) => isHighImpactAuditAction(event.action)).length
  const latestFailure = events.find((event) => event.outcome === 'FAILURE') ?? null

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">
            {categoryFilter === 'ALL'
              ? (isPolish ? 'Zdarzenia w oknie' : 'Events in window')
              : isPolish
                ? `Zdarzenia: ${labelAuditCategory(categoryFilter)}`
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
                {labelAuditCategory(option)}
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
            <option value="ALL">{isPolish ? 'Wszystkie' : 'All'}</option>
            <option value="HIGH_IMPACT_ONLY">{isPolish ? 'Tylko kluczowe' : 'High impact only'}</option>
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
            const metadataSummary = buildAuditMetadataSummary(event.metadata, isPolish)
            const metadataEntries = buildAuditMetadataEntries(event.metadata, isPolish)
            const highImpact = isHighImpactAuditAction(event.action)
            return (
              <article className="rounded-lg border border-zinc-800/50 p-4" key={event.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-sm text-zinc-100">{formatAuditEventTitle(event.action, isPolish)}</strong>
                    <p className="text-sm text-zinc-500">
                      {labelAuditCategory(event.category)} · {formatDateTime(event.occurredAt)}
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

                <p className="mt-2 text-sm text-zinc-300">{formatAuditEventMessage(event, isPolish)}</p>
                {metadataSummary ? <p className="text-sm text-zinc-500">{metadataSummary}</p> : null}
                {metadataEntries.length > 0 ? (
                  <details className="mt-3 rounded-md border border-zinc-800/50 bg-zinc-950/50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      {isPolish ? 'Szczegóły błędu i kontekstu' : 'Failure and context details'}
                    </summary>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,180px)_1fr]">
                      {metadataEntries.map(([label, value]) => (
                        <div className="contents" key={label}>
                          <dt className="text-xs uppercase tracking-[0.2em] text-zinc-600">{label}</dt>
                          <dd className="break-words font-mono text-xs text-zinc-300">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
                {event.entityId ? <p className="mt-1 text-xs font-mono text-zinc-600">{event.entityId}</p> : null}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
