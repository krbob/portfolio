import { useMemo, type ReactNode } from 'react'
import { useMarketDataSnapshots } from '../hooks/use-read-model'
import { formatDate, formatDateTime, formatNumber } from '../lib/format'
import { formatMessage, t } from '../lib/messages'
import {
  summarizeMarketDataProvenance,
  type MarketDataProvenanceSummary,
  type MarketProvenanceStatus,
} from '../lib/market-data-provenance'

export function MarketDataStatusBar() {
  const snapshotsQuery = useMarketDataSnapshots()
  const summary = useMemo(
    () => summarizeMarketDataProvenance(Array.isArray(snapshotsQuery.data) ? snapshotsQuery.data : []),
    [snapshotsQuery.data],
  )
  if (!summary) return null

  return <MarketDataStatusBarContent summary={summary} isRefreshing={snapshotsQuery.isFetching} />
}

export function MarketDataStatusBarContent({
  summary,
  isRefreshing = false,
}: {
  summary: MarketDataProvenanceSummary
  isRefreshing?: boolean
}) {
  return (
    <section
      aria-label={t('marketStatus.ariaLabel')}
      className="border-b border-ui-border bg-ui-surface"
      data-testid="market-data-status-bar"
    >
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-xs text-ui-text-muted sm:px-5 lg:px-8">
        <strong className="font-semibold text-ui-text">{t('marketStatus.title')}</strong>
        <span>{formatMessage(t('marketStatus.datasets'), { count: summary.datasetCount })}</span>
        <dl className="contents">
          <DataPoint label={t('marketStatus.source')} value={formatSources(summary.sources)} />
          <DataPoint label={t('marketStatus.observed')}>
            <time dateTime={summary.observedAt ?? undefined}>{formatTemporal(summary.observedAt)}</time>
          </DataPoint>
          <DataPoint label={t('marketStatus.retrieved')}>
            <time dateTime={summary.retrievedAt ?? undefined}>{formatDateTime(summary.retrievedAt)}</time>
          </DataPoint>
          <DataPoint label={t('marketStatus.coverage')}>
            <Coverage from={summary.coverageFrom} to={summary.coverageTo} />
          </DataPoint>
          <DataPoint label={t('marketStatus.currency')} value={compact(summary.currencies)} />
          <DataPoint label={t('marketStatus.unit')} value={formatUnitScales(summary.unitScales)} />
          <DataPoint label={t('marketStatus.adjustment')} value={formatAdjustments(summary.adjustments)} />
          <DataPoint label={t('marketStatus.status')}>
            <span
              aria-live="polite"
              className={`rounded-ui-pill px-2 py-0.5 font-semibold ${statusClass(summary.status)}`}
            >
              {statusLabel(summary.status)}
            </span>
          </DataPoint>
        </dl>
        {summary.refreshFailureCount > 0 ? (
          <span className="font-medium text-ui-danger">
            {formatMessage(t('marketStatus.refreshFailures'), { count: summary.refreshFailureCount })}
          </span>
        ) : null}
        {isRefreshing ? (
          <span role="status" className="font-medium text-ui-action">{t('marketStatus.refreshing')}</span>
        ) : null}
      </div>
    </section>
  )
}

function DataPoint({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap">
      <dt>{label}:</dt>
      <dd className="font-medium text-ui-text-secondary">{children ?? (value || t('marketStatus.notReported'))}</dd>
    </div>
  )
}

function Coverage({ from, to }: { from: string | null; to: string | null }) {
  if (!from && !to) return <>{t('marketStatus.notReported')}</>
  if (from === to || !from || !to) {
    const value = from ?? to!
    return <time dateTime={value}>{formatDate(value)}</time>
  }
  return (
    <>
      <time dateTime={from}>{formatDate(from)}</time>
      {'–'}
      <time dateTime={to}>{formatDate(to)}</time>
    </>
  )
}

function formatTemporal(value: string | null) {
  return value?.includes('T') ? formatDateTime(value) : formatDate(value)
}

function formatSources(values: string[]) {
  return compact(values.map((value) => value === 'YAHOO_FINANCE' ? 'Yahoo Finance' : humanize(value)))
}

function formatAdjustments(values: string[]) {
  return compact(values.map((value) => {
    switch (value) {
      case 'RAW': return t('marketStatus.adjustmentRaw')
      case 'SPLIT_ADJUSTED': return t('marketStatus.adjustmentSplit')
      case 'TOTAL_RETURN': return t('marketStatus.adjustmentTotalReturn')
      default: return humanize(value)
    }
  }))
}

function formatUnitScales(values: number[]) {
  return values.length > 0 ? values.map((value) => `×${formatNumber(value, { maximumFractionDigits: 4 })}`).join(', ') : ''
}

function compact(values: string[]) {
  if (values.length <= 3) return values.join(', ')
  return `${values.slice(0, 3).join(', ')} +${values.length - 3}`
}

function humanize(value: string) {
  return value.trim().toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function statusLabel(status: MarketProvenanceStatus) {
  const labels = {
    FRESH: t('marketStatus.fresh'),
    PARTIAL: t('marketStatus.partial'),
    STALE: t('marketStatus.stale'),
    ERROR: t('marketStatus.error'),
    UNKNOWN: t('marketStatus.unknown'),
  } satisfies Record<MarketProvenanceStatus, string>
  return labels[status]
}

function statusClass(status: MarketProvenanceStatus) {
  switch (status) {
    case 'FRESH': return 'bg-ui-positive/15 text-ui-positive'
    case 'PARTIAL':
    case 'STALE': return 'bg-ui-highlight/15 text-ui-highlight'
    case 'ERROR': return 'bg-ui-danger/15 text-ui-danger'
    case 'UNKNOWN': return 'bg-ui-surface-raised text-ui-text-muted'
  }
}
