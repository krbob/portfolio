import type { ReadModelSnapshot } from '../api/read-model'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'

export function ReadModelSnapshotStatus({ label, snapshot, isFetching, isError, onRetry }: {
  label: string
  snapshot?: ReadModelSnapshot
  isFetching: boolean
  isError: boolean
  onRetry: () => void
}) {
  const { language } = useI18n()
  if (!snapshot) return null
  const failed = isError || snapshot.refreshFailed
  const state = failed
    ? (language === 'pl' ? 'Odświeżenie nie powiodło się.' : 'Refresh failed.')
    : isFetching ? (language === 'pl' ? 'Odświeżanie…' : 'Refreshing…') : ''
  return <p role="status" className="mb-2 text-xs text-ui-text-muted">
    {label}: {formatDateTime(snapshot.generatedAt)}{state && ` · ${state}`}
    {failed && <> <button type="button" className="underline" onClick={onRetry}>{language === 'pl' ? 'Ponów' : 'Retry'}</button></>}
  </p>
}
