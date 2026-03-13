import { useState, type ChangeEvent, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import {
  useAccounts,
  useExportPortfolioState,
  useImportPortfolioState,
  useInstruments,
  usePreviewPortfolioStateImport,
  useTransactions,
} from '../hooks/use-write-model'
import type { PortfolioStateSnapshot, PreviewPortfolioStateImportResult } from '../api/write-model'

export function PortfolioStateSection() {
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const exportMutation = useExportPortfolioState()
  const previewMutation = usePreviewPortfolioStateImport()
  const importMutation = useImportPortfolioState()

  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE')
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
        `Exported ${snapshot.accounts.length} accounts, ${snapshot.instruments.length} instruments and ${snapshot.transactions.length} transactions.`,
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Export failed.')
    }
  }

  async function handlePreviewClick() {
    setImportFeedback(null)
    setImportError(null)

    if (selectedFileContent.trim() === '') {
      setImportError('Choose a JSON snapshot file first.')
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
          ? 'Preview ready. The snapshot passed validation.'
          : 'Preview ready. Resolve blocking issues before importing.',
      )
    } catch (error) {
      setPreviewResult(null)
      setImportError(error instanceof Error ? error.message : 'Preview failed.')
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
      setImportError('Choose a JSON snapshot file first.')
      return
    }

    if (previewResult == null) {
      setImportError('Preview the selected snapshot before importing.')
      return
    }

    if (!previewResult.isValid) {
      setImportError('The selected snapshot has blocking issues. Fix them before importing.')
      return
    }

    if (importMode === 'REPLACE' && !window.confirm('Replace the current portfolio state with the imported snapshot?')) {
      return
    }

    try {
      const snapshot = parseSelectedSnapshot(selectedFileContent)
      const result = await importMutation.mutateAsync({
        mode: importMode,
        snapshot,
      })
      setPreviewResult(null)
      setImportFeedback(
        `Imported ${result.accountCount} accounts, ${result.instrumentCount} instruments and ${result.transactionCount} transactions in ${result.mode} mode.`,
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  return (
    <SectionCard
      eyebrow="Transfer"
      title="Backup and restore"
      description="Export the canonical write model as a JSON snapshot or import a previously exported snapshot in merge or replace mode."
    >
      <div className="transfer-grid">
        <article className="transfer-box">
          <span>Accounts</span>
          <strong>{accountsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="transfer-box">
          <span>Instruments</span>
          <strong>{instrumentsQuery.data?.length ?? '...'}</strong>
        </article>
        <article className="transfer-box">
          <span>Transactions</span>
          <strong>{transactionsQuery.data?.length ?? '...'}</strong>
        </article>
      </div>

      <div className="transfer-layout">
        <div className="transfer-card">
          <div className="section-header">
            <p className="eyebrow">Export</p>
            <h4>Download snapshot</h4>
            <p>
              Generates a canonical JSON snapshot that includes accounts, instruments and transactions with original ids and timestamps.
            </p>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleExportClick} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? 'Exporting...' : 'Export JSON'}
            </button>
          </div>
        </div>

        <form className="transfer-card" onSubmit={handleImportSubmit}>
          <div className="section-header">
            <p className="eyebrow">Import</p>
            <h4>Restore snapshot</h4>
            <p>
              `MERGE` upserts by id. `REPLACE` clears the current write model before loading the snapshot.
            </p>
          </div>

          <label className="journal-filter">
            <span>Import mode</span>
            <select
              value={importMode}
              onChange={(event) => {
                setImportMode(event.target.value as 'MERGE' | 'REPLACE')
                setPreviewResult(null)
                setImportFeedback(null)
                setImportError(null)
              }}
            >
              <option value="MERGE">MERGE</option>
              <option value="REPLACE">REPLACE</option>
            </select>
          </label>

          <label className="transfer-file">
            <span>Snapshot file</span>
            <input type="file" accept="application/json,.json" onChange={handleFileChange} />
          </label>

          <p className="muted-copy">
            {selectedFileName !== '' ? `Selected file: ${selectedFileName}` : 'No snapshot file selected yet.'}
          </p>

          {previewResult && (
            <div className="transfer-preview">
              <div className="holding-header">
                <h5>Preview summary</h5>
                <span className={`status-badge ${previewResult.isValid ? 'status-valued' : 'status-unavailable'}`}>
                  {previewResult.isValid ? 'VALID' : 'BLOCKED'}
                </span>
              </div>

              <div className="transfer-preview-grid">
                <PreviewMetricCard
                  label="Accounts"
                  snapshotCount={previewResult.snapshotAccountCount}
                  existingCount={previewResult.existingAccountCount}
                  matchingCount={previewResult.matchingAccountCount}
                />
                <PreviewMetricCard
                  label="Instruments"
                  snapshotCount={previewResult.snapshotInstrumentCount}
                  existingCount={previewResult.existingInstrumentCount}
                  matchingCount={previewResult.matchingInstrumentCount}
                />
                <PreviewMetricCard
                  label="Transactions"
                  snapshotCount={previewResult.snapshotTransactionCount}
                  existingCount={previewResult.existingTransactionCount}
                  matchingCount={previewResult.matchingTransactionCount}
                />
              </div>

              <p className="muted-copy">
                {previewResult.mode === 'REPLACE'
                  ? `REPLACE will clear the current write model first: ${previewResult.existingAccountCount} accounts, ${previewResult.existingInstrumentCount} instruments and ${previewResult.existingTransactionCount} transactions.`
                  : `MERGE will upsert ${previewResult.matchingAccountCount} accounts, ${previewResult.matchingInstrumentCount} instruments and ${previewResult.matchingTransactionCount} transactions by id.`}
              </p>

              {previewResult.issues.length > 0 && (
                <ul className="transfer-issues">
                  {previewResult.issues.map((issue) => (
                    <li key={`${issue.code}:${issue.message}`} className={`transfer-issue transfer-issue-${issue.severity.toLowerCase()}`}>
                      <strong>{issue.code}</strong>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={handlePreviewClick} disabled={previewMutation.isPending || selectedFileContent.trim() === ''}>
              {previewMutation.isPending ? 'Previewing...' : 'Preview snapshot'}
            </button>
            <button
              type="submit"
              disabled={
                importMutation.isPending ||
                previewMutation.isPending ||
                selectedFileContent.trim() === '' ||
                previewResult == null ||
                !previewResult.isValid
              }
            >
              {importMutation.isPending ? 'Importing...' : 'Import JSON'}
            </button>
          </div>
        </form>
      </div>

      {(importFeedback || importError || exportMutation.error || previewMutation.error || importMutation.error) && (
        <div className="overview-notes">
          {importFeedback && <p className="muted-copy">{importFeedback}</p>}
          {(importError || exportMutation.error || previewMutation.error || importMutation.error) && (
            <p className="form-error">
              {importError ?? exportMutation.error?.message ?? previewMutation.error?.message ?? importMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </SectionCard>
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
    <article className="transfer-preview-card">
      <span>{label}</span>
      <dl>
        <div>
          <dt>Snapshot</dt>
          <dd>{snapshotCount}</dd>
        </div>
        <div>
          <dt>Current</dt>
          <dd>{existingCount}</dd>
        </div>
        <div>
          <dt>Matching ids</dt>
          <dd>{matchingCount}</dd>
        </div>
      </dl>
    </article>
  )
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
    throw new Error('Snapshot file must contain valid JSON.')
  }
}
