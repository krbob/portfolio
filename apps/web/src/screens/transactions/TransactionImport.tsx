import { useMemo, useState, type FormEvent } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { ImportAuditPanel } from '../../components/ImportAuditPanel'
import type {
  CsvTransactionsImportPayload,
  ImportTransactionsPayload,
  ImportTransactionsPreviewResult,
  TransactionImportProfile,
} from '../../api/write-model'
import { t } from '../../lib/messages'
import { card } from '../../lib/styles'
import {
  buildImportResultMessage,
  normalizeOptionalValue,
  parseStructuredImportPayload,
  type ImportBatchMode,
  type ImportPreviewStatusFilter,
} from './transactions-helpers'
import { CsvTransactionImportForm } from './import/CsvTransactionImportForm'
import { StructuredTransactionImportForm } from './import/StructuredTransactionImportForm'

export interface TransactionImportProps {
  selectedImportProfile: TransactionImportProfile | null
  importProfileBlockingReason: string | null
  importProfileTemplate: string
  previewTransactionsCsvImportMutation: UseMutationResult<ImportTransactionsPreviewResult, Error, CsvTransactionsImportPayload>
  importTransactionsCsvMutation: UseMutationResult<
    { createdCount: number; skippedDuplicateCount: number },
    Error,
    CsvTransactionsImportPayload
  >
  previewTransactionsImportMutation: UseMutationResult<ImportTransactionsPreviewResult, Error, ImportTransactionsPayload>
  importTransactionsMutation: UseMutationResult<
    { createdCount: number; skippedDuplicateCount: number },
    Error,
    ImportTransactionsPayload
  >
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
  const [importPreviewStatusFilter, setImportPreviewStatusFilter] = useState<ImportPreviewStatusFilter>('ALL')
  const [structuredImportJson, setStructuredImportJson] = useState('')
  const [structuredImportSkipDuplicates, setStructuredImportSkipDuplicates] = useState(true)
  const [structuredImportFeedback, setStructuredImportFeedback] = useState<string | null>(null)
  const [structuredImportError, setStructuredImportError] = useState<string | null>(null)
  const [structuredImportPreview, setStructuredImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [structuredImportPreviewStatusFilter, setStructuredImportPreviewStatusFilter] =
    useState<ImportPreviewStatusFilter>('ALL')

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

  const visibleStructuredImportPreviewRows = useMemo(() => {
    if (structuredImportPreview == null || structuredImportPreviewStatusFilter === 'ALL') {
      return structuredImportPreview?.rows ?? []
    }

    return structuredImportPreview.rows.filter((row) => row.status === structuredImportPreviewStatusFilter)
  }, [structuredImportPreview, structuredImportPreviewStatusFilter])

  const csvResetKey = `${importCsv}|${importSkipDuplicates}|${importSourceFileName}|${importSourceLabel}|${selectedImportProfile?.id}|${importProfileBlockingReason}`
  const structuredResetKey = `${structuredImportJson}|${structuredImportSkipDuplicates}`

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
      setImportError(importProfileBlockingReason ?? t('import.saveProfileBeforePreview'))
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
      setImportError(importProfileBlockingReason ?? t('import.saveProfileBeforeImport'))
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
      setStructuredImportError(error instanceof Error ? error.message : t('import.previewFailed'))
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
          setStructuredImportFeedback(buildImportResultMessage(result.createdCount, result.skippedDuplicateCount))
          setStructuredImportJson('')
          setStructuredImportPreview(null)
        },
        onError: (error) => {
          setStructuredImportError(error.message)
        },
      })
    } catch (error) {
      setStructuredImportError(error instanceof Error ? error.message : t('import.importFailed'))
    }
  }

  const importErrorMessage =
    importError ?? previewTransactionsCsvImportMutation.error?.message ?? importTransactionsCsvMutation.error?.message ?? null
  const structuredImportErrorMessage =
    structuredImportError ??
    previewTransactionsImportMutation.error?.message ??
    importTransactionsMutation.error?.message ??
    null

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
          <p className="mt-1 text-sm text-zinc-500">{t('import.batchImportDescription')}</p>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="tablist" aria-label={t('import.batchModeLabel')}>
          {(
            [
              ['csv', t('import.csvWithProfile')],
              ['structured', t('import.structuredJson')],
            ] as const
          ).map(([mode, modeLabel]) => (
            <button
              key={mode}
              id={`transactions-import-mode-tab-${mode}`}
              type="button"
              role="tab"
              aria-selected={mode === importBatchMode}
              aria-controls={`transactions-import-mode-panel-${mode}`}
              tabIndex={mode === importBatchMode ? 0 : -1}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === importBatchMode ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'
              }`}
              onClick={() => setImportBatchMode(mode)}
            >
              {modeLabel}
            </button>
          ))}
        </div>

        {importBatchMode === 'csv' ? (
          <CsvTransactionImportForm
            selectedImportProfile={selectedImportProfile}
            importProfileBlockingReason={importProfileBlockingReason}
            importProfileTemplate={importProfileTemplate}
            importCsv={importCsv}
            importSkipDuplicates={importSkipDuplicates}
            importSourceFileName={importSourceFileName}
            importSourceLabel={importSourceLabel}
            importBlockedByPreview={importBlockedByPreview}
            importPreview={importPreview}
            importPreviewStatusFilter={importPreviewStatusFilter}
            visibleImportPreviewRows={visibleImportPreviewRows}
            importFeedback={importFeedback}
            importErrorMessage={importErrorMessage}
            previewPending={previewTransactionsCsvImportMutation.isPending}
            importPending={importTransactionsCsvMutation.isPending}
            onSubmit={handleImportSubmit}
            onPreview={handleImportPreview}
            onImportCsvChange={setImportCsv}
            onSkipDuplicatesChange={setImportSkipDuplicates}
            onSourceFileNameChange={setImportSourceFileName}
            onSourceLabelChange={setImportSourceLabel}
            onPreviewStatusFilterChange={setImportPreviewStatusFilter}
          />
        ) : (
          <StructuredTransactionImportForm
            structuredImportJson={structuredImportJson}
            structuredImportSkipDuplicates={structuredImportSkipDuplicates}
            structuredImportBlockedByPreview={structuredImportBlockedByPreview}
            structuredImportPreview={structuredImportPreview}
            structuredImportPreviewStatusFilter={structuredImportPreviewStatusFilter}
            visibleStructuredImportPreviewRows={visibleStructuredImportPreviewRows}
            structuredImportFeedback={structuredImportFeedback}
            structuredImportErrorMessage={structuredImportErrorMessage}
            previewPending={previewTransactionsImportMutation.isPending}
            importPending={importTransactionsMutation.isPending}
            onSubmit={handleStructuredImportSubmit}
            onPreview={handleStructuredImportPreview}
            onStructuredImportJsonChange={setStructuredImportJson}
            onSkipDuplicatesChange={setStructuredImportSkipDuplicates}
            onPreviewStatusFilterChange={setStructuredImportPreviewStatusFilter}
          />
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
