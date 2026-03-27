import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Card, SectionHeader } from './ui'
import {
  useAccounts,
  useExportPortfolioState,
  useImportPortfolioState,
  useInstruments,
  usePortfolioTargets,
  usePreviewPortfolioStateImport,
  useTransactionImportProfiles,
  useTransactions,
} from '../hooks/use-write-model'
import type { PortfolioStateSnapshot, PreviewPortfolioStateImportResult } from '../api/write-model'
import { formatMessage, t } from '../lib/messages'
import { label as labelClass, input, btnPrimary, btnSecondary, badge, badgeVariants } from '../lib/styles'

export function PortfolioStateSection() {
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const targetsQuery = usePortfolioTargets()
  const importProfilesQuery = useTransactionImportProfiles()
  const transactionsQuery = useTransactions()
  const exportMutation = useExportPortfolioState()
  const previewMutation = usePreviewPortfolioStateImport()
  const importMutation = useImportPortfolioState()

  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE')
  const [replaceConfirmation, setReplaceConfirmation] = useState('')
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [selectedFileContent, setSelectedFileContent] = useState<string>('')
  const [previewResult, setPreviewResult] = useState<PreviewPortfolioStateImportResult | null>(null)
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExportClick() {
    setImportFeedback(null)
    setImportError(null)

    try {
      const snapshot = await exportMutation.mutateAsync()
      downloadSnapshot(snapshot)
      setImportFeedback(
        formatMessage(t('state.exportSummary'), {
          accounts: snapshot.accounts.length,
          appPreferences: snapshot.appPreferences?.length ?? 0,
          instruments: snapshot.instruments.length,
          targets: snapshot.targets?.length ?? 0,
          transactions: snapshot.transactions.length,
          importProfiles: snapshot.importProfiles?.length ?? 0,
        }),
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('state.exportFailed'))
    }
  }

  async function handlePreviewClick() {
    setImportFeedback(null)
    setImportError(null)

    if (selectedFileContent.trim() === '') {
      setImportError(t('state.chooseFileFirst'))
      setPreviewResult(null)
      return
    }

    try {
      const snapshot = parseSelectedSnapshot(selectedFileContent)
      const result = await previewMutation.mutateAsync({
        mode: importMode,
        snapshot,
      })
      setPreviewResult(result)
      setImportFeedback(
        result.isValid
          ? t('state.previewValidOk')
          : t('state.previewValidBlocked'),
      )
    } catch (error) {
      setPreviewResult(null)
      setImportError(error instanceof Error ? error.message : t('state.previewFailed'))
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedFileName('')
      setSelectedFileContent('')
      setPreviewResult(null)
      return
    }

    setSelectedFileName(file.name)
    setSelectedFileContent(await file.text())
    setPreviewResult(null)
    setImportFeedback(null)
    setImportError(null)
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportFeedback(null)
    setImportError(null)

    if (selectedFileContent.trim() === '') {
      setImportError(t('state.chooseFileFirst'))
      return
    }

    if (previewResult == null) {
      setImportError(t('state.previewFirst'))
      return
    }

    if (!previewResult.isValid) {
      setImportError(t('state.hasBlockingIssues'))
      return
    }

    try {
      const snapshot = parseSelectedSnapshot(selectedFileContent)
      const result = await importMutation.mutateAsync({
        mode: importMode,
        confirmation: importMode === 'REPLACE' ? replaceConfirmation : undefined,
        snapshot,
      })
      setPreviewResult(null)
      setImportFeedback(
        formatMessage(
          t(result.safetyBackupFileName ? 'state.importSummaryWithBackup' : 'state.importSummary'),
          {
            accounts: result.accountCount,
            appPreferences: result.appPreferenceCount,
            instruments: result.instrumentCount,
            targets: result.targetCount,
            transactions: result.transactionCount,
            importProfiles: result.importProfileCount,
            mode: result.mode,
            backupFile: result.safetyBackupFileName,
          },
        ),
      )
      setReplaceConfirmation('')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('state.importFailed'))
    }
  }

  return (
    <Card>
      <SectionHeader
        eyebrow={t('state.eyebrow')}
        title={t('state.title')}
        description={t('state.description')}
      />

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('state.accounts')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{accountsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('state.instruments')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{instrumentsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('state.targets')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{targetsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('state.transactions')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{transactionsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('state.importProfiles')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{importProfilesQuery.data?.length ?? '...'}</strong>
        </article>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-800/50 p-4">
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('state.exportLabel')}</p>
            <h4 className="mt-1 text-base font-semibold text-zinc-100">{t('state.exportTitle')}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {t('state.exportDescription')}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button className={btnPrimary} type="button" onClick={handleExportClick} disabled={exportMutation.isPending}>
              {exportMutation.isPending
                ? t('state.exporting')
                : t('state.exportJson')}
            </button>
          </div>
        </div>

        <form className="rounded-lg border border-zinc-800/50 p-4" onSubmit={handleImportSubmit}>
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t('state.importLabel')}</p>
            <h4 className="mt-1 text-base font-semibold text-zinc-100">{t('state.importTitle')}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {t('state.importDescriptionMerge')}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {t('state.importDescriptionReplace')}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <span className={labelClass}>{t('state.importMode')}</span>
              <select
                className={input}
                value={importMode}
                onChange={(event) => {
                  setImportMode(event.target.value as 'MERGE' | 'REPLACE')
                  setReplaceConfirmation('')
                  setPreviewResult(null)
                  setImportFeedback(null)
                  setImportError(null)
                }}
              >
                <option value="MERGE">MERGE</option>
                <option value="REPLACE">REPLACE</option>
              </select>
            </div>

            {importMode === 'REPLACE' && (
              <div>
                <span className={labelClass}>{t('state.typeReplace')}</span>
                <input
                  className={input}
                  type="text"
                  value={replaceConfirmation}
                  onChange={(event) => setReplaceConfirmation(event.target.value)}
                  placeholder="REPLACE"
                />
              </div>
            )}

            <div>
              <span className={labelClass}>{t('state.snapshotFile')}</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-300 hover:file:bg-zinc-700"
              />
            </div>
          </div>

          <p className="text-sm text-zinc-500 mt-2">
            {selectedFileName !== ''
              ? formatMessage(t('state.selectedFile'), { fileName: selectedFileName })
              : t('state.noFileSelected')}
          </p>

          {previewResult && (
            <div className="mt-4 rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-zinc-100">{t('state.previewSummary')}</h5>
                <span className={`${badge} ${previewResult.isValid ? badgeVariants.success : badgeVariants.error}`}>
                  {previewResult.isValid
                    ? t('state.valid')
                    : t('state.blocked')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <PreviewMetricCard
                  label={t('state.accounts')}
                  snapshotCount={previewResult.snapshotAccountCount}
                  existingCount={previewResult.existingAccountCount}
                  matchingCount={previewResult.matchingAccountCount}
                />
                <PreviewMetricCard
                  label={t('state.appSettings')}
                  snapshotCount={previewResult.snapshotAppPreferenceCount}
                  existingCount={previewResult.existingAppPreferenceCount}
                  matchingCount={previewResult.matchingAppPreferenceCount}
                />
                <PreviewMetricCard
                  label={t('state.instruments')}
                  snapshotCount={previewResult.snapshotInstrumentCount}
                  existingCount={previewResult.existingInstrumentCount}
                  matchingCount={previewResult.matchingInstrumentCount}
                />
                <PreviewMetricCard
                  label={t('state.targets')}
                  snapshotCount={previewResult.snapshotTargetCount}
                  existingCount={previewResult.existingTargetCount}
                  matchingCount={previewResult.matchingTargetCount}
                />
                <PreviewMetricCard
                  label={t('state.transactions')}
                  snapshotCount={previewResult.snapshotTransactionCount}
                  existingCount={previewResult.existingTransactionCount}
                  matchingCount={previewResult.matchingTransactionCount}
                />
                <PreviewMetricCard
                  label={t('state.importProfiles')}
                  snapshotCount={previewResult.snapshotImportProfileCount}
                  existingCount={previewResult.existingImportProfileCount}
                  matchingCount={previewResult.matchingImportProfileCount}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <PreviewChangeCard label={t('state.accounts')} diff={previewResult.diff.accounts} />
                <PreviewChangeCard label={t('state.appSettings')} diff={previewResult.diff.appPreferences} />
                <PreviewChangeCard label={t('state.instruments')} diff={previewResult.diff.instruments} />
                <PreviewChangeCard label={t('state.targets')} diff={previewResult.diff.targets} />
                <PreviewChangeCard label={t('state.transactions')} diff={previewResult.diff.transactions} />
                <PreviewChangeCard label={t('state.importProfiles')} diff={previewResult.diff.importProfiles} />
              </div>

              <p className="text-sm text-zinc-500 mt-3">
                {describePreviewMode(previewResult)}
              </p>

              <p className="text-sm text-zinc-500 mt-2">
                {describeTargetDiff(previewResult)}
              </p>

              {previewResult.issues.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {previewResult.issues.map((issue) => (
                    <li
                      key={`${issue.code}:${issue.message}`}
                      className={`rounded-lg px-3 py-2 text-sm ${issue.severity === 'ERROR' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}
                    >
                      <strong>{issue.code}</strong>
                      <span className="ml-2">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button className={btnSecondary} type="button" onClick={handlePreviewClick} disabled={previewMutation.isPending || selectedFileContent.trim() === ''}>
              {previewMutation.isPending
                ? t('state.previewing')
                : t('state.previewSnapshot')}
            </button>
            <button
              className={btnPrimary}
              type="submit"
              disabled={
                importMutation.isPending ||
                previewMutation.isPending ||
                selectedFileContent.trim() === '' ||
                previewResult == null ||
                !previewResult.isValid ||
                (importMode === 'REPLACE' && replaceConfirmation.trim().toUpperCase() !== 'REPLACE')
              }
            >
              {importMutation.isPending
                ? t('state.importing')
                : t('state.importJson')}
            </button>
          </div>
        </form>
      </div>

      {(importFeedback || importError || exportMutation.error || previewMutation.error || importMutation.error) && (
        <div className="mt-4 space-y-1">
          {importFeedback && <p className="text-sm text-zinc-500">{importFeedback}</p>}
          {(importError || exportMutation.error || previewMutation.error || importMutation.error) && (
            <p className="text-sm text-red-400">
              {importError ?? exportMutation.error?.message ?? previewMutation.error?.message ?? importMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function PreviewMetricCard({
  label,
  snapshotCount,
  existingCount,
  matchingCount,
}: {
  label: string
  snapshotCount: number
  existingCount: number
  matchingCount: number
}) {
  return (
    <article className="rounded-lg border border-zinc-800/50 p-3">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">{t('state.snapshot')}</dt>
          <dd className="text-zinc-100 tabular-nums">{snapshotCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">{t('state.current')}</dt>
          <dd className="text-zinc-100 tabular-nums">{existingCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">{t('state.matchingIds')}</dt>
          <dd className="text-zinc-100 tabular-nums">{matchingCount}</dd>
        </div>
      </dl>
    </article>
  )
}

function PreviewChangeCard({
  label,
  diff,
}: {
  label: string
  diff: PreviewPortfolioStateImportResult['diff']['accounts']
}) {
  return (
    <article className="rounded-lg border border-zinc-800/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        {diff.sectionSkipped ? (
          <span className={`${badge} ${badgeVariants.info}`}>{t('state.sectionSkipped')}</span>
        ) : null}
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <PreviewDiffRow label={t('state.created')} value={diff.createdCount} />
        <PreviewDiffRow label={t('state.updated')} value={diff.updatedCount} />
        <PreviewDiffRow label={t('state.unchanged')} value={diff.unchangedCount} />
        <PreviewDiffRow label={t('state.preserved')} value={diff.preservedCount} />
        <PreviewDiffRow label={t('state.deleted')} value={diff.deletedCount} />
      </dl>
    </article>
  )
}

function PreviewDiffRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-100 tabular-nums">{value}</dd>
    </div>
  )
}

function describePreviewMode(previewResult: PreviewPortfolioStateImportResult) {
  if (previewResult.mode === 'REPLACE') {
    return formatMessage(t('state.modeReplaceSummary'), {
      accounts: previewResult.existingAccountCount,
      appPreferences: previewResult.existingAppPreferenceCount,
      instruments: previewResult.existingInstrumentCount,
      targets: previewResult.existingTargetCount,
      transactions: previewResult.existingTransactionCount,
      importProfiles: previewResult.existingImportProfileCount,
    })
  }

  return formatMessage(t('state.modeMergeSummary'), {
    accounts: previewResult.matchingAccountCount,
    appPreferences: previewResult.matchingAppPreferenceCount,
    instruments: previewResult.matchingInstrumentCount,
    targets: previewResult.matchingTargetCount,
    transactions: previewResult.matchingTransactionCount,
    importProfiles: previewResult.matchingImportProfileCount,
  })
}

function describeTargetDiff(previewResult: PreviewPortfolioStateImportResult) {
  if (previewResult.diff.targets.sectionSkipped) {
    return t('state.targetsPreservedSummary')
  }

  return t('state.targetsReplaceSummary')
}

function downloadSnapshot(snapshot: PortfolioStateSnapshot) {
  const payload = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `portfolio-state-${snapshot.exportedAt.slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function parseSelectedSnapshot(rawSnapshot: string): PortfolioStateSnapshot {
  try {
    return JSON.parse(rawSnapshot) as PortfolioStateSnapshot
  } catch {
    throw new Error(t('state.invalidJson'))
  }
}
