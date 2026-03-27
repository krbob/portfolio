import type { FormEvent } from 'react'
import type { ImportTransactionsPreviewResult, TransactionImportProfile } from '../../../api/write-model'
import { t } from '../../../lib/messages'
import { badge, btnPrimary, btnSecondary, filterInput, label as labelClass } from '../../../lib/styles'
import { ImportPreviewPanel } from './ImportPreviewPanel'
import type { ImportPreviewStatusFilter } from '../transactions-helpers'

interface CsvTransactionImportFormProps {
  selectedImportProfile: TransactionImportProfile | null
  importProfileBlockingReason: string | null
  importProfileTemplate: string
  importCsv: string
  importSkipDuplicates: boolean
  importSourceFileName: string
  importSourceLabel: string
  importBlockedByPreview: boolean
  importPreview: ImportTransactionsPreviewResult | null
  importPreviewStatusFilter: ImportPreviewStatusFilter
  visibleImportPreviewRows: ImportTransactionsPreviewResult['rows']
  importFeedback: string | null
  importErrorMessage: string | null
  previewPending: boolean
  importPending: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPreview: () => void
  onImportCsvChange: (value: string) => void
  onSkipDuplicatesChange: (value: boolean) => void
  onSourceFileNameChange: (value: string) => void
  onSourceLabelChange: (value: string) => void
  onPreviewStatusFilterChange: (value: ImportPreviewStatusFilter) => void
}

export function CsvTransactionImportForm({
  selectedImportProfile,
  importProfileBlockingReason,
  importProfileTemplate,
  importCsv,
  importSkipDuplicates,
  importSourceFileName,
  importSourceLabel,
  importBlockedByPreview,
  importPreview,
  importPreviewStatusFilter,
  visibleImportPreviewRows,
  importFeedback,
  importErrorMessage,
  previewPending,
  importPending,
  onSubmit,
  onPreview,
  onImportCsvChange,
  onSkipDuplicatesChange,
  onSourceFileNameChange,
  onSourceLabelChange,
  onPreviewStatusFilterChange,
}: CsvTransactionImportFormProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={onSubmit}
      role="tabpanel"
      id="transactions-import-mode-panel-csv"
      aria-labelledby="transactions-import-mode-tab-csv"
    >
      <div>
        <span className={`${badge} bg-zinc-800 text-zinc-400`}>
          {selectedImportProfile ? selectedImportProfile.name : t('import.noProfileSelected')}
        </span>
        {importProfileBlockingReason && <p className="mt-1 text-sm text-zinc-500">{importProfileBlockingReason}</p>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1">
          <span className={labelClass}>{t('import.sourceFile')}</span>
          <input
            className={filterInput}
            value={importSourceFileName}
            onChange={(event) => onSourceFileNameChange(event.target.value)}
            placeholder="ibkr-activity-2026-03.csv"
          />
        </label>
        <label className="min-w-[200px] flex-1">
          <span className={labelClass}>{t('import.sourceLabel')}</span>
          <input
            className={filterInput}
            value={importSourceLabel}
            onChange={(event) => onSourceLabelChange(event.target.value)}
            placeholder={t('import.sourceLabelPlaceholder')}
          />
        </label>
      </div>

      <textarea
        className="min-h-[200px] w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        value={importCsv}
        onChange={(event) => onImportCsvChange(event.target.value)}
        placeholder={importProfileTemplate}
      />

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="accent-blue-500"
          checked={importSkipDuplicates}
          onChange={(event) => onSkipDuplicatesChange(event.target.checked)}
          disabled={selectedImportProfile == null}
        />
        <span>{t('import.skipDuplicates')}</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btnSecondary}
          onClick={onPreview}
          disabled={previewPending || importCsv.trim() === '' || importProfileBlockingReason !== null}
        >
          {previewPending ? t('import.previewing') : t('import.previewImport')}
        </button>
        <button
          className={btnPrimary}
          type="submit"
          disabled={importPending || previewPending || importCsv.trim() === '' || importBlockedByPreview || importProfileBlockingReason !== null}
        >
          {importPending ? t('import.importing') : t('import.importCsv')}
        </button>
      </div>

      {importPreview && (
        <ImportPreviewPanel
          preview={importPreview}
          skipDuplicates={importSkipDuplicates}
          statusFilter={importPreviewStatusFilter}
          onStatusFilterChange={onPreviewStatusFilterChange}
          rows={visibleImportPreviewRows}
        />
      )}

      {importFeedback && <p className="text-sm text-zinc-500">{importFeedback}</p>}
      {importErrorMessage && <p className="text-sm text-red-400">{importErrorMessage}</p>}
    </form>
  )
}
