import { useState } from 'react'
import { SectionHeader } from './ui'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { buildAuditMetadataSummary, formatAuditEventMessage, formatAuditEventTitle } from '../lib/audit-copy'
import { labelAuditOutcome } from '../lib/labels'
import { t } from '../lib/messages'
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
      <SectionHeader eyebrow={t('importAudit.eyebrow')} title={title} description={description} />

      {latestEvent && (
        <p className="text-sm text-zinc-500">
          {t('importAudit.latestEvent')} {formatAuditEventMessage(latestEvent, isPolish)} ·{' '}
          {formatDateTime(latestEvent.occurredAt)}
        </p>
      )}

      <div className="flex items-center gap-3 my-3">
        <label>
          <span className={label}>{t('importAudit.outcome')}</span>
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
          {t('importAudit.loadingActivity')}
        </p>
      )}
      {eventsQuery.isError && <p className="text-sm text-red-400">{eventsQuery.error.message}</p>}
      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length === 0 && (
        <p className="text-sm text-zinc-500">
          {t('importAudit.noEvents')}
        </p>
      )}
      {!eventsQuery.isLoading && !eventsQuery.isError && visibleEvents.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          {visibleEvents.map((event) => {
            const metadataSummary = buildAuditMetadataSummary(event.metadata, isPolish)
            return (
              <article className="rounded-lg border border-zinc-800/50 p-3" key={event.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-sm font-medium text-zinc-200">{formatAuditEventTitle(event.action, isPolish)}</strong>
                    <p className="text-xs text-zinc-500">
                      {formatAuditEventMessage(event, isPolish)} · {formatDateTime(event.occurredAt)}
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
