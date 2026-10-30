import clsx from 'clsx'
import { useState } from 'react'
import { Modal } from '../../components/ui'
import { IconWarning } from '../../components/ui/icons'
import { formatDateTime } from '../../lib/format'
import { t } from '../../lib/messages'
import { btnSecondary } from '../../lib/styles'

interface DataStatusItem {
  label: string
  generatedAt?: string
  isFetching: boolean
  failed: boolean
  description?: string
  onRetry: () => void
}

export function DashboardDataStatus({ items, valuationDate, valuationDescription }: {
  items: DataStatusItem[]
  valuationDate: string
  valuationDescription: string
}) {
  const [open, setOpen] = useState(false)
  const failed = items.some((item) => item.failed)
  const fetching = items.some((item) => item.isFetching)
  const status = failed ? t('dashboard.dataRefreshFailed') : fetching ? t('common.refreshing') : valuationDate

  return <>
    <button
      type="button"
      aria-label={t('dashboard.dataStatus')}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      className={clsx(
        btnSecondary,
        'flex h-14 w-56 shrink-0 items-center gap-2 text-left',
        failed && 'border-ui-highlight/50 text-ui-highlight',
      )}
    >
      <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
        {failed ? <IconWarning className="h-4 w-4" /> : fetching
          ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ui-text-muted border-t-transparent motion-reduce:animate-none" />
          : <span className="h-2 w-2 rounded-full bg-ui-text-muted" />}
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-sm">{t('dashboard.dataStatus')}</span>
        <span role="status" className="block truncate text-xs text-ui-text-muted">{status}</span>
      </span>
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={t('dashboard.dataStatus')}>
      <p className="mb-5 text-sm text-ui-text-muted">{valuationDescription}</p>
      <dl className="space-y-5">
        {items.map((item) => <div key={item.label}>
          <dt className="text-sm font-medium text-ui-text">{item.label}</dt>
          <dd className="mt-1 space-y-1 text-sm text-ui-text-muted">
            <p>{item.generatedAt
              ? <time dateTime={item.generatedAt}>{formatDateTime(item.generatedAt)}</time>
              : t('dashboard.dataTimestampUnavailable')}</p>
            <p role="status" className={clsx(item.failed && 'text-ui-highlight')}>
              {item.description ?? (item.failed
                ? t('dashboard.dataRefreshFailed')
                : item.isFetching ? t('common.refreshing') : '')}
            </p>
            {item.failed && <button
              type="button"
              className="rounded px-2 py-2 underline"
              aria-label={`${t('common.retry')}: ${item.label}`}
              onClick={item.onRetry}
            >{t('common.retry')}</button>}
          </dd>
        </div>)}
      </dl>
    </Modal>
  </>
}
