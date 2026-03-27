import { useI18n } from '../../../lib/i18n'
import { labelImportRowStatus } from '../../../lib/labels'
import { t } from '../../../lib/messages'
import { badge } from '../../../lib/styles'
import type { ImportTransactionsPreviewResult } from '../../../api/write-model'
import { buildImportPreviewSummary, importPreviewBadgeVariant, type ImportPreviewStatusFilter } from '../transactions-helpers'

interface ImportPreviewPanelProps {
  preview: ImportTransactionsPreviewResult
  skipDuplicates: boolean
  statusFilter: ImportPreviewStatusFilter
  onStatusFilterChange: (status: ImportPreviewStatusFilter) => void
  rows: ImportTransactionsPreviewResult['rows']
}

export function ImportPreviewPanel({
  preview,
  skipDuplicates,
  statusFilter,
  onStatusFilterChange,
  rows,
}: ImportPreviewPanelProps) {
  const { isPolish } = useI18n()

  return (
    <div className="mt-6">
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.totalRows')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.totalRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.importable')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">
            {preview.importableRowCount}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.existingDuplicates')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">
            {preview.duplicateExistingCount}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.batchDuplicates')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">
            {preview.duplicateBatchCount}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.invalid')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.invalidRowCount}</strong>
        </article>
      </div>

      <p className="mb-4 text-sm text-zinc-500">{buildImportPreviewSummary(preview, skipDuplicates)}</p>

      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1"
          role="group"
          aria-label={t('import.previewRowsLabel')}
        >
          {(
            [
              ['ALL', isPolish ? `Wszystkie (${preview.totalRowCount})` : `All (${preview.totalRowCount})`],
              [
                'IMPORTABLE',
                isPolish ? `Do importu (${preview.importableRowCount})` : `Importable (${preview.importableRowCount})`,
              ],
              [
                'DUPLICATE_EXISTING',
                isPolish
                  ? `Istniejące (${preview.duplicateExistingCount})`
                  : `Existing (${preview.duplicateExistingCount})`,
              ],
              ['DUPLICATE_BATCH', isPolish ? `Paczka (${preview.duplicateBatchCount})` : `Batch (${preview.duplicateBatchCount})`],
              ['INVALID', isPolish ? `Błędne (${preview.invalidRowCount})` : `Invalid (${preview.invalidRowCount})`],
            ] as const
          ).map(([status, statusLabel]) => (
            <button
              key={status}
              type="button"
              aria-pressed={status === statusFilter}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === statusFilter ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'
              }`}
              onClick={() => onStatusFilterChange(status)}
            >
              {statusLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <article
            className="flex items-center justify-between rounded-lg border border-zinc-800/50 px-4 py-3"
            key={`${row.rowNumber}-${row.status}`}
          >
            <div>
              <strong className="text-sm font-medium text-zinc-100">
                {t('import.row')} {row.rowNumber}
              </strong>
              <p className="text-sm text-zinc-500">{row.message}</p>
            </div>
            <span className={`${badge} ${importPreviewBadgeVariant(row.status)}`}>
              {labelImportRowStatus(row.status)}
            </span>
          </article>
        ))}
        {rows.length === 0 && <p className="text-sm text-zinc-500">{t('import.noPreviewRows')}</p>}
      </div>
    </div>
  )
}
