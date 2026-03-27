import type { FormEvent } from 'react'
import type { ImportTransactionsPreviewResult } from '../../../api/write-model'
import { t } from '../../../lib/messages'
import { btnPrimary, btnSecondary } from '../../../lib/styles'
import { ImportPreviewPanel } from './ImportPreviewPanel'
import { STRUCTURED_IMPORT_TEMPLATE, type ImportPreviewStatusFilter } from '../transactions-helpers'

interface StructuredTransactionImportFormProps {
  structuredImportJson: string
  structuredImportSkipDuplicates: boolean
  structuredImportBlockedByPreview: boolean
  structuredImportPreview: ImportTransactionsPreviewResult | null
  structuredImportPreviewStatusFilter: ImportPreviewStatusFilter
  visibleStructuredImportPreviewRows: ImportTransactionsPreviewResult['rows']
  structuredImportFeedback: string | null
  structuredImportErrorMessage: string | null
  previewPending: boolean
  importPending: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPreview: () => void
  onStructuredImportJsonChange: (value: string) => void
  onSkipDuplicatesChange: (value: boolean) => void
  onPreviewStatusFilterChange: (value: ImportPreviewStatusFilter) => void
}

export function StructuredTransactionImportForm({
  structuredImportJson,
  structuredImportSkipDuplicates,
  structuredImportBlockedByPreview,
  structuredImportPreview,
  structuredImportPreviewStatusFilter,
  visibleStructuredImportPreviewRows,
  structuredImportFeedback,
  structuredImportErrorMessage,
  previewPending,
  importPending,
  onSubmit,
  onPreview,
  onStructuredImportJsonChange,
  onSkipDuplicatesChange,
  onPreviewStatusFilterChange,
}: StructuredTransactionImportFormProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={onSubmit}
      role="tabpanel"
      id="transactions-import-mode-panel-structured"
      aria-labelledby="transactions-import-mode-tab-structured"
    >
      <div className="space-y-1">
        <p className="text-sm text-zinc-500">{t('import.structuredJsonHint')}</p>
        <p className="text-sm text-zinc-500">{t('import.structuredJsonBypass')}</p>
      </div>

      <textarea
        className="min-h-[220px] w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        value={structuredImportJson}
        onChange={(event) => onStructuredImportJsonChange(event.target.value)}
        placeholder={STRUCTURED_IMPORT_TEMPLATE}
      />

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="accent-blue-500"
          checked={structuredImportSkipDuplicates}
          onChange={(event) => onSkipDuplicatesChange(event.target.checked)}
        />
        <span>{t('import.skipDuplicates')}</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btnSecondary}
          onClick={onPreview}
          disabled={previewPending || structuredImportJson.trim() === ''}
        >
          {previewPending ? t('import.previewing') : t('import.previewImport')}
        </button>
        <button
          className={btnPrimary}
          type="submit"
          disabled={importPending || previewPending || structuredImportJson.trim() === '' || structuredImportBlockedByPreview}
        >
          {importPending ? t('import.importing') : t('import.importJsonBatch')}
        </button>
      </div>

      {structuredImportPreview && (
        <ImportPreviewPanel
          preview={structuredImportPreview}
          skipDuplicates={structuredImportSkipDuplicates}
          statusFilter={structuredImportPreviewStatusFilter}
          onStatusFilterChange={onPreviewStatusFilterChange}
          rows={visibleStructuredImportPreviewRows}
        />
      )}

      {structuredImportFeedback && <p className="text-sm text-zinc-500">{structuredImportFeedback}</p>}
      {structuredImportErrorMessage && <p className="text-sm text-red-400">{structuredImportErrorMessage}</p>}
    </form>
  )
}
