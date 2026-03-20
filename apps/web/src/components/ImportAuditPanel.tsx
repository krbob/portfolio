import { useState } from 'react'
import { SectionHeader } from './ui'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatDateTime } from '../lib/format'
import { getActiveUiLanguage, useI18n } from '../lib/i18n'
import { labelAuditOutcome } from '../lib/labels'
import { badge, badgeVariants, filterInput, label } from '../lib/styles'

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
  const { isPolish } = useI18n()
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
      <SectionHeader eyebrow={isPolish ? 'Audyt' : 'Audit'} title={title} description={description} />

      {latestEvent && (
        <p className="text-sm text-zinc-500">
          {isPolish ? 'Ostatnie zdarzenie:' : 'Latest event:'} {latestEvent.message} ·{' '}
          {formatDateTime(latestEvent.occurredAt)}
        </p>
      )}

      <div className="flex items-center gap-3 my-3">
        <label>
          <span className={label}>{isPolish ? 'Wynik' : 'Outcome'}</span>
          <select
            className={filterInput}
            value={outcomeFilter}
            onChange={(event) =>
              setOutcomeFilter(event.target.value as 'ALL' | 'SUCCESS' | 'FAILURE')
            }
          >
            <option value="ALL">{labelAuditOutcome('ALL')}</option>
            <option value="SUCCESS">{labelAuditOutcome('SUCCESS')}</option>
            <option value="FAILURE">{labelAuditOutcome('FAILURE')}</option>
          </select>
        </label>
      </div>

      {eventsQuery.isLoading && (
        <p className="text-sm text-zinc-500">
          {isPolish ? 'Ładowanie aktywności importu...' : 'Loading import activity...'}
        </p>
      )}
      {eventsQuery.isError && <p className="text-sm text-red-400">{eventsQuery.error.message}</p>}
      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length === 0 && (
        <p className="text-sm text-zinc-500">
          {isPolish
            ? 'Brak jeszcze zdarzeń audytu związanych z importem.'
            : 'No import-related audit events yet.'}
        </p>
      )}
      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length > 0 && (
        <div className="space-y-3">
          {visibleEvents.map((event) => {
            const metadataSummary = buildImportMetadataSummary(event.metadata)
            return (
              <article className="rounded-lg border border-zinc-800/50 p-3" key={event.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-sm font-medium text-zinc-200">{event.message}</strong>
                    <p className="text-xs text-zinc-500">
                      {event.action} · {formatDateTime(event.occurredAt)}
                    </p>
                  </div>
                  <span
                    className={`${badge} ${event.outcome === 'FAILURE' ? badgeVariants.error : badgeVariants.success}`}
                  >
                    {labelAuditOutcome(event.outcome)}
                  </span>
                </div>
                {metadataSummary && <p className="text-sm text-zinc-500">{metadataSummary}</p>}
                {event.entityId && <p className="text-xs text-zinc-600 font-mono mt-1">{event.entityId}</p>}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

function buildImportMetadataSummary(metadata: Record<string, string>) {
  const isPolish = getActiveUiLanguage() === 'pl'
  const parts: string[] = []

  if (metadata.sourceLabel) {
    parts.push(metadata.sourceLabel)
  }

  if (metadata.sourceFileName) {
    parts.push(metadata.sourceFileName)
  }

  if (metadata.profileName) {
    parts.push(isPolish ? `profil ${metadata.profileName}` : `profile ${metadata.profileName}`)
  }

  if (metadata.createdCount) {
    parts.push(isPolish ? `utworzono ${metadata.createdCount}` : `created ${metadata.createdCount}`)
  }

  if (metadata.skippedDuplicateCount && metadata.skippedDuplicateCount !== '0') {
    parts.push(isPolish ? `pominięto ${metadata.skippedDuplicateCount}` : `skipped ${metadata.skippedDuplicateCount}`)
  }

  if (metadata.invalidRowCount && metadata.invalidRowCount !== '0') {
    parts.push(isPolish ? `błędne ${metadata.invalidRowCount}` : `invalid ${metadata.invalidRowCount}`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}
