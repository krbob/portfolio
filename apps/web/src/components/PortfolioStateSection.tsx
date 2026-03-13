import { useState, type ChangeEvent, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import { useAccounts, useExportPortfolioState, useImportPortfolioState, useInstruments, useTransactions } from '../hooks/use-write-model'
import type { PortfolioStateSnapshot } from '../api/write-model'

export function PortfolioStateSection() {
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const exportMutation = useExportPortfolioState()
  const importMutation = useImportPortfolioState()

  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE')
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [selectedFileContent, setSelectedFileContent] = useState<string>('')
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedFileName('')
      setSelectedFileContent('')
      return
    }

    setSelectedFileName(file.name)
    setSelectedFileContent(await file.text())
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

    if (importMode === 'REPLACE' && !window.confirm('Replace the current portfolio state with the imported snapshot?')) {
      return
    }

    try {
      const snapshot = JSON.parse(selectedFileContent) as PortfolioStateSnapshot
      const result = await importMutation.mutateAsync({
        mode: importMode,
        snapshot,
      })
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
            <select value={importMode} onChange={(event) => setImportMode(event.target.value as 'MERGE' | 'REPLACE')}>
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

          <div className="form-actions">
            <button type="submit" disabled={importMutation.isPending || selectedFileContent.trim() === ''}>
              {importMutation.isPending ? 'Importing...' : 'Import JSON'}
            </button>
          </div>
        </form>
      </div>

      {(importFeedback || importError || exportMutation.error || importMutation.error) && (
        <div className="overview-notes">
          {importFeedback && <p className="muted-copy">{importFeedback}</p>}
          {(importError || exportMutation.error || importMutation.error) && (
            <p className="form-error">
              {importError ?? exportMutation.error?.message ?? importMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </SectionCard>
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
