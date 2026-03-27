import { useMemo, useState, type FormEvent } from 'react'
import { ImportAuditPanel } from '../../components/ImportAuditPanel'
import { useI18n } from '../../lib/i18n'
import { labelImportRowStatus } from '../../lib/labels'
import { t } from '../../lib/messages'
import {
  badge,
  btnPrimary,
  btnSecondary,
  card,
  filterInput,
  label as labelClass,
} from '../../lib/styles'
import type { UseMutationResult } from '@tanstack/react-query'
import type {
  ImportTransactionsPayload,
  ImportTransactionsPreviewResult,
  TransactionImportProfile,
} from '../../api/write-model'
import type { CsvTransactionsImportPayload } from '../../api/write-model'
import {
  buildImportPreviewSummary,
  buildImportResultMessage,
  importPreviewBadgeVariant,
  normalizeOptionalValue,
  parseStructuredImportPayload,
  STRUCTURED_IMPORT_TEMPLATE,
  type ImportBatchMode,
  type ImportPreviewStatusFilter,
} from './transactions-helpers'

interface ImportPreviewPanelProps {
  preview: ImportTransactionsPreviewResult
  skipDuplicates: boolean
  statusFilter: ImportPreviewStatusFilter
  onStatusFilterChange: (status: ImportPreviewStatusFilter) => void
  rows: ImportTransactionsPreviewResult['rows']
}

function ImportPreviewPanel({
  preview,
  skipDuplicates,
  statusFilter,
  onStatusFilterChange,
  rows,
}: ImportPreviewPanelProps) {
  const { isPolish } = useI18n()
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 mb-3 lg:grid-cols-5">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.totalRows')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.totalRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.importable')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.importableRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.existingDuplicates')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.duplicateExistingCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.batchDuplicates')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.duplicateBatchCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('import.invalid')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.invalidRowCount}</strong>
        </article>
      </div>

      <p className="text-sm text-zinc-500 mb-4">
        {buildImportPreviewSummary(preview, skipDuplicates)}
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="group" aria-label={t('import.previewRowsLabel')}>
          {(
            [
              ['ALL', isPolish ? `Wszystkie (${preview.totalRowCount})` : `All (${preview.totalRowCount})`],
              ['IMPORTABLE', isPolish ? `Do importu (${preview.importableRowCount})` : `Importable (${preview.importableRowCount})`],
              ['DUPLICATE_EXISTING', isPolish ? `Istniejące (${preview.duplicateExistingCount})` : `Existing (${preview.duplicateExistingCount})`],
              ['DUPLICATE_BATCH', isPolish ? `Paczka (${preview.duplicateBatchCount})` : `Batch (${preview.duplicateBatchCount})`],
              ['INVALID', isPolish ? `Błędne (${preview.invalidRowCount})` : `Invalid (${preview.invalidRowCount})`],
            ] as const
          ).map(([status, statusLabel]) => (
            <button
              key={status}
              type="button"
              aria-pressed={status === statusFilter}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${status === statusFilter ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}
              onClick={() => onStatusFilterChange(status)}
            >
              {statusLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <article className="flex items-center justify-between rounded-lg border border-zinc-800/50 px-4 py-3" key={`${row.rowNumber}-${row.status}`}>
            <div>
              <strong className="text-sm font-medium text-zinc-100">{t('import.row')} {row.rowNumber}</strong>
              <p className="text-sm text-zinc-500">{row.message}</p>
            </div>
            <span className={`${badge} ${importPreviewBadgeVariant(row.status)}`}>
              {labelImportRowStatus(row.status)}
            </span>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-zinc-500">
            {t('import.noPreviewRows')}
          </p>
        )}
      </div>
    </div>
  )
}

export interface TransactionImportProps {
  selectedImportProfile: TransactionImportProfile | null
  importProfileBlockingReason: string | null
  importProfileTemplate: string
  previewTransactionsCsvImportMutation: UseMutationResult<ImportTransactionsPreviewResult, Error, CsvTransactionsImportPayload>
  importTransactionsCsvMutation: UseMutationResult<{ createdCount: number; skippedDuplicateCount: number }, Error, CsvTransactionsImportPayload>
  previewTransactionsImportMutation: UseMutationResult<ImportTransactionsPreviewResult, Error, ImportTransactionsPayload>
  importTransactionsMutation: UseMutationResult<{ createdCount: number; skippedDuplicateCount: number }, Error, ImportTransactionsPayload>
}

export function TransactionImport({
  selectedImportProfile,
  importProfileBlockingReason,
  importProfileTemplate,
  previewTransactionsCsvImportMutation,
  importTransactionsCsvMutation,
  previewTransactionsImportMutation,
  importTransactionsMutation,
}: TransactionImportProps) {
  const [importBatchMode, setImportBatchMode] = useState<ImportBatchMode>('csv')
  const [importCsv, setImportCsv] = useState('')
  const [importSkipDuplicates, setImportSkipDuplicates] = useState(true)
  const [importSourceFileName, setImportSourceFileName] = useState('')
  const [importSourceLabel, setImportSourceLabel] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [importPreviewStatusFilter, setImportPreviewStatusFilter] =
    useState<ImportPreviewStatusFilter>('ALL')
  const [structuredImportJson, setStructuredImportJson] = useState('')
  const [structuredImportSkipDuplicates, setStructuredImportSkipDuplicates] = useState(true)
  const [structuredImportFeedback, setStructuredImportFeedback] = useState<string | null>(null)
  const [structuredImportError, setStructuredImportError] = useState<string | null>(null)
  const [structuredImportPreview, setStructuredImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [structuredImportPreviewStatusFilter, setStructuredImportPreviewStatusFilter] =
    useState<ImportPreviewStatusFilter>('ALL')

  // Sync importSkipDuplicates with the profile's default when profile identity or its default changes
  const profileSyncKey = `${selectedImportProfile?.id}:${selectedImportProfile?.skipDuplicatesByDefault}`
  const [prevProfileSyncKey, setPrevProfileSyncKey] = useState(profileSyncKey)
  if (prevProfileSyncKey !== profileSyncKey) {
    setPrevProfileSyncKey(profileSyncKey)
    const nextDefault = selectedImportProfile?.skipDuplicatesByDefault ?? true
    if (importSkipDuplicates !== nextDefault) setImportSkipDuplicates(nextDefault)
  }

  const importBlockedByPreview = Boolean(
    importPreview &&
      (importPreview.invalidRowCount > 0 || (!importSkipDuplicates && importPreview.duplicateRowCount > 0)),
  )
  const structuredImportBlockedByPreview = Boolean(
    structuredImportPreview &&
      (structuredImportPreview.invalidRowCount > 0 ||
        (!structuredImportSkipDuplicates && structuredImportPreview.duplicateRowCount > 0)),
  )

  const visibleImportPreviewRows = useMemo(() => {
    if (importPreview == null || importPreviewStatusFilter === 'ALL') {
      return importPreview?.rows ?? []
    }

    return importPreview.rows.filter((row) => row.status === importPreviewStatusFilter)
  }, [importPreview, importPreviewStatusFilter])

  // Reset import state when inputs change, using derived-state-during-render pattern
  const csvResetKey = `${importCsv}|${importSkipDuplicates}|${importSourceFileName}|${importSourceLabel}|${selectedImportProfile?.id}|${importProfileBlockingReason}`
  const structuredResetKey = `${structuredImportJson}|${structuredImportSkipDuplicates}`

  // Use useState with key to reset CSV import state
  const [prevCsvResetKey, setPrevCsvResetKey] = useState(csvResetKey)
  if (prevCsvResetKey !== csvResetKey) {
    setPrevCsvResetKey(csvResetKey)
    if (importFeedback !== null) setImportFeedback(null)
    if (importError !== null) setImportError(null)
    if (importPreview !== null) setImportPreview(null)
    if (importPreviewStatusFilter !== 'ALL') setImportPreviewStatusFilter('ALL')
  }

  const [prevStructuredResetKey, setPrevStructuredResetKey] = useState(structuredResetKey)
  if (prevStructuredResetKey !== structuredResetKey) {
    setPrevStructuredResetKey(structuredResetKey)
    if (structuredImportFeedback !== null) setStructuredImportFeedback(null)
    if (structuredImportError !== null) setStructuredImportError(null)
    if (structuredImportPreview !== null) setStructuredImportPreview(null)
    if (structuredImportPreviewStatusFilter !== 'ALL') setStructuredImportPreviewStatusFilter('ALL')
  }

  function handleImportPreview() {
    setImportFeedback(null)
    setImportError(null)

    if (selectedImportProfile == null) {
      setImportPreview(null)
      setImportError(
        importProfileBlockingReason ?? t('import.saveProfileBeforePreview'),
      )
      return
    }

    previewTransactionsCsvImportMutation.mutate(
      {
        profileId: selectedImportProfile.id,
        csv: importCsv,
        skipDuplicates: importSkipDuplicates,
        sourceFileName: normalizeOptionalValue(importSourceFileName),
        sourceLabel: normalizeOptionalValue(importSourceLabel),
      },
      {
        onSuccess: (result) => {
          setImportPreview(result)
        },
        onError: (error) => {
          setImportPreview(null)
          setImportError(error.message)
        },
      },
    )
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportFeedback(null)
    setImportError(null)

    if (selectedImportProfile == null) {
      setImportError(
        importProfileBlockingReason ?? t('import.saveProfileBeforeImport'),
      )
      return
    }

    importTransactionsCsvMutation.mutate(
      {
        profileId: selectedImportProfile.id,
        csv: importCsv,
        skipDuplicates: importSkipDuplicates,
        sourceFileName: normalizeOptionalValue(importSourceFileName),
        sourceLabel: normalizeOptionalValue(importSourceLabel),
      },
      {
        onSuccess: (result) => {
          setImportFeedback(buildImportResultMessage(result.createdCount, result.skippedDuplicateCount))
          setImportCsv('')
          setImportPreview(null)
        },
        onError: (error) => {
          setImportError(error.message)
        },
      },
    )
  }

  function handleStructuredImportPreview() {
    setStructuredImportFeedback(null)
    setStructuredImportError(null)

    try {
      const payload = parseStructuredImportPayload(structuredImportJson, structuredImportSkipDuplicates)
      previewTransactionsImportMutation.mutate(payload, {
        onSuccess: (result) => {
          setStructuredImportPreview(result)
        },
        onError: (error) => {
          setStructuredImportPreview(null)
          setStructuredImportError(error.message)
        },
      })
    } catch (error) {
      setStructuredImportPreview(null)
      setStructuredImportError(
        error instanceof Error ? error.message : t('import.previewFailed'),
      )
    }
  }

  function handleStructuredImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStructuredImportFeedback(null)
    setStructuredImportError(null)

    try {
      const payload = parseStructuredImportPayload(structuredImportJson, structuredImportSkipDuplicates)
      importTransactionsMutation.mutate(payload, {
        onSuccess: (result) => {
          setStructuredImportFeedback(
            buildImportResultMessage(result.createdCount, result.skippedDuplicateCount),
          )
          setStructuredImportJson('')
          setStructuredImportPreview(null)
        },
        onError: (error) => {
          setStructuredImportError(error.message)
        },
      })
    } catch (error) {
      setStructuredImportError(
        error instanceof Error ? error.message : t('import.importFailed'),
      )
    }
  }

  return (
    <>
      <section
        className={card}
        role="tabpanel"
        id="transactions-workspace-panel-import"
        aria-labelledby="transactions-workspace-tab-import"
      >
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('import.batchImportEyebrow')}</p>
          <h4 className="mt-1 text-lg font-semibold text-zinc-100">{t('import.batchImportTitle')}</h4>
          <p className="mt-1 text-sm text-zinc-500">
            {t('import.batchImportDescription')}
          </p>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="tablist" aria-label={t('import.batchModeLabel')}>
          {([
            ['csv', t('import.csvWithProfile')],
            ['structured', t('import.structuredJson')],
          ] as const).map(([mode, modeLabel]) => (
            <button
              key={mode}
              id={`transactions-import-mode-tab-${mode}`}
              type="button"
              role="tab"
              aria-selected={mode === importBatchMode}
              aria-controls={`transactions-import-mode-panel-${mode}`}
              tabIndex={mode === importBatchMode ? 0 : -1}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === importBatchMode ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}
              onClick={() => setImportBatchMode(mode)}
            >
              {modeLabel}
            </button>
          ))}
        </div>

        {importBatchMode === 'csv' && (
          <form
            className="space-y-4"
            onSubmit={handleImportSubmit}
            role="tabpanel"
            id="transactions-import-mode-panel-csv"
            aria-labelledby="transactions-import-mode-tab-csv"
          >
            <div>
              <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                {selectedImportProfile
                  ? selectedImportProfile.name
                  : t('import.noProfileSelected')}
              </span>
              {importProfileBlockingReason && <p className="text-sm text-zinc-500 mt-1">{importProfileBlockingReason}</p>}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 min-w-[200px]">
                <span className={labelClass}>{t('import.sourceFile')}</span>
                <input
                  className={filterInput}
                  value={importSourceFileName}
                  onChange={(event) => setImportSourceFileName(event.target.value)}
                  placeholder="ibkr-activity-2026-03.csv"
                />
              </label>
              <label className="flex-1 min-w-[200px]">
                <span className={labelClass}>{t('import.sourceLabel')}</span>
                <input
                  className={filterInput}
                  value={importSourceLabel}
                  onChange={(event) => setImportSourceLabel(event.target.value)}
                  placeholder={t('import.sourceLabelPlaceholder')}
                />
              </label>
            </div>

            <textarea
              className="min-h-[200px] w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              value={importCsv}
              onChange={(event) => setImportCsv(event.target.value)}
              placeholder={importProfileTemplate}
            />

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={importSkipDuplicates}
                onChange={(event) => setImportSkipDuplicates(event.target.checked)}
                disabled={selectedImportProfile == null}
              />
              <span>{t('import.skipDuplicates')}</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={handleImportPreview}
                disabled={
                  previewTransactionsCsvImportMutation.isPending ||
                  importCsv.trim() === '' ||
                  importProfileBlockingReason !== null
                }
              >
                {previewTransactionsCsvImportMutation.isPending
                  ? t('import.previewing')
                  : t('import.previewImport')}
              </button>
              <button
                className={btnPrimary}
                type="submit"
                disabled={
                  importTransactionsCsvMutation.isPending ||
                  previewTransactionsCsvImportMutation.isPending ||
                  importCsv.trim() === '' ||
                  importBlockedByPreview ||
                  importProfileBlockingReason !== null
                }
              >
                {importTransactionsCsvMutation.isPending
                  ? t('import.importing')
                  : t('import.importCsv')}
              </button>
            </div>

            {importPreview && (
              <ImportPreviewPanel
                preview={importPreview}
                skipDuplicates={importSkipDuplicates}
                statusFilter={importPreviewStatusFilter}
                onStatusFilterChange={setImportPreviewStatusFilter}
                rows={visibleImportPreviewRows}
              />
            )}

            {importFeedback && <p className="text-sm text-zinc-500">{importFeedback}</p>}
            {(importError || previewTransactionsCsvImportMutation.error || importTransactionsCsvMutation.error) && (
              <p className="text-sm text-red-400">
                {importError ??
                  previewTransactionsCsvImportMutation.error?.message ??
                  importTransactionsCsvMutation.error?.message}
              </p>
            )}
          </form>
        )}

        {importBatchMode === 'structured' && (
          <form
            className="space-y-4"
            onSubmit={handleStructuredImportSubmit}
            role="tabpanel"
            id="transactions-import-mode-panel-structured"
            aria-labelledby="transactions-import-mode-tab-structured"
          >
            <div className="space-y-1">
              <p className="text-sm text-zinc-500">
                {t('import.structuredJsonHint')}
              </p>
              <p className="text-sm text-zinc-500">
                {t('import.structuredJsonBypass')}
              </p>
            </div>

            <textarea
              className="min-h-[220px] w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              value={structuredImportJson}
              onChange={(event) => setStructuredImportJson(event.target.value)}
              placeholder={STRUCTURED_IMPORT_TEMPLATE}
            />

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={structuredImportSkipDuplicates}
                onChange={(event) => setStructuredImportSkipDuplicates(event.target.checked)}
              />
              <span>{t('import.skipDuplicates')}</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={handleStructuredImportPreview}
                disabled={previewTransactionsImportMutation.isPending || structuredImportJson.trim() === ''}
              >
                {previewTransactionsImportMutation.isPending
                  ? t('import.previewing')
                  : t('import.previewImport')}
              </button>
              <button
                className={btnPrimary}
                type="submit"
                disabled={
                  importTransactionsMutation.isPending ||
                  previewTransactionsImportMutation.isPending ||
                  structuredImportJson.trim() === '' ||
                  structuredImportBlockedByPreview
                }
              >
                {importTransactionsMutation.isPending
                  ? t('import.importing')
                  : t('import.importJsonBatch')}
              </button>
            </div>

            {structuredImportPreview && (
              <ImportPreviewPanel
                preview={structuredImportPreview}
                skipDuplicates={structuredImportSkipDuplicates}
                statusFilter={structuredImportPreviewStatusFilter}
                onStatusFilterChange={setStructuredImportPreviewStatusFilter}
                rows={structuredImportPreviewStatusFilter === 'ALL'
                  ? structuredImportPreview.rows
                  : structuredImportPreview.rows.filter((row) => row.status === structuredImportPreviewStatusFilter)}
              />
            )}

            {structuredImportFeedback && <p className="text-sm text-zinc-500">{structuredImportFeedback}</p>}
            {(structuredImportError || previewTransactionsImportMutation.error || importTransactionsMutation.error) && (
              <p className="text-sm text-red-400">
                {structuredImportError ??
                  previewTransactionsImportMutation.error?.message ??
                  importTransactionsMutation.error?.message}
              </p>
            )}
          </form>
        )}
      </section>

      <section className={card}>
        <ImportAuditPanel
          title={t('import.recentImports')}
          description={t('import.recentImportsDescription')}
          limit={8}
        />
      </section>
    </>
  )
}
