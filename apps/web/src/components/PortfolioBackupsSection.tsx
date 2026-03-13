import { useState } from 'react'
import { SectionCard } from './SectionCard'
import { usePortfolioBackups, useRestorePortfolioBackup, useRunPortfolioBackup } from '../hooks/use-write-model'

export function PortfolioBackupsSection() {
  const backupsQuery = usePortfolioBackups()
  const runBackupMutation = useRunPortfolioBackup()
  const restoreBackupMutation = useRestorePortfolioBackup()

  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleRunBackupClick() {
    setFeedback(null)
    setActionError(null)

    try {
      const result = await runBackupMutation.mutateAsync()
      setFeedback(`Created backup ${result.fileName}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Backup run failed.')
    }
  }

  async function handleRestoreClick(fileName: string) {
    setFeedback(null)
    setActionError(null)

    if (restoreMode === 'REPLACE' && !window.confirm(`Replace the current portfolio state with backup ${fileName}?`)) {
      return
    }

    try {
      const result = await restoreBackupMutation.mutateAsync({
        fileName,
        mode: restoreMode,
      })
      setFeedback(
        `Restored ${result.fileName} in ${result.mode} mode: ${result.accountCount} accounts, ${result.instrumentCount} instruments, ${result.transactionCount} transactions.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Restore failed.')
    }
  }

  const backups = backupsQuery.data?.backups ?? []

  return (
    <SectionCard
      eyebrow="Backups"
      title="Server snapshots"
      description="Keep canonical JSON backups on the server, trigger them on demand, and restore a known-good state without downloading files first."
    >
      <div className="backup-summary-grid">
        <article className="transfer-box">
          <span>Scheduler</span>
          <strong>{backupsQuery.data?.schedulerEnabled ? 'Enabled' : 'Manual only'}</strong>
        </article>
        <article className="transfer-box">
          <span>Interval</span>
          <strong>{backupsQuery.data ? `${backupsQuery.data.intervalMinutes} min` : '...'}</strong>
        </article>
        <article className="transfer-box">
          <span>Retention</span>
          <strong>{backupsQuery.data ? `${backupsQuery.data.retentionCount} files` : '...'}</strong>
        </article>
        <article className="transfer-box">
          <span>Stored backups</span>
          <strong>{backupsQuery.data ? backups.length : '...'}</strong>
        </article>
      </div>

      <div className="backup-toolbar">
        <label className="journal-filter">
          <span>Restore mode</span>
          <select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value as 'MERGE' | 'REPLACE')}>
            <option value="MERGE">MERGE</option>
            <option value="REPLACE">REPLACE</option>
          </select>
        </label>

        <div className="form-actions">
          <button type="button" onClick={handleRunBackupClick} disabled={runBackupMutation.isPending || backupsQuery.isLoading}>
            {runBackupMutation.isPending ? 'Running...' : 'Run backup now'}
          </button>
        </div>
      </div>

      <div className="overview-notes">
        <p className="muted-copy">Directory: {backupsQuery.data?.directory ?? 'Loading...'}</p>
        <p className="muted-copy">
          Last success: {backupsQuery.data?.lastSuccessAt ? formatTimestamp(backupsQuery.data.lastSuccessAt) : 'No successful backup yet.'}
        </p>
        {backupsQuery.data?.lastFailureMessage && (
          <p className="form-error">
            Last failure: {backupsQuery.data.lastFailureAt ? `${formatTimestamp(backupsQuery.data.lastFailureAt)}: ` : ''}
            {backupsQuery.data.lastFailureMessage}
          </p>
        )}
      </div>

      {backupsQuery.isLoading && <p className="muted-copy">Loading server backups...</p>}
      {backupsQuery.isError && <p className="form-error">{backupsQuery.error.message}</p>}

      {!backupsQuery.isLoading && !backupsQuery.isError && (
        <div className="backup-list">
          {backups.length === 0 && <p className="muted-copy">No server backups have been created yet.</p>}

          {backups.map((backup) => (
            <article key={backup.fileName} className="backup-item">
              <div className="backup-item-header">
                <div>
                  <h4>{backup.fileName}</h4>
                  <p className="muted-copy">
                    Exported {backup.exportedAt ? formatTimestamp(backup.exportedAt) : 'unknown'} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>

                <span className={`status-badge ${backup.isReadable ? 'status-valued' : 'status-unavailable'}`}>
                  {backup.isReadable ? 'READY' : 'BROKEN'}
                </span>
              </div>

              <dl className="backup-item-meta">
                <div>
                  <dt>Accounts</dt>
                  <dd>{backup.accountCount ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt>Instruments</dt>
                  <dd>{backup.instrumentCount ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt>Transactions</dt>
                  <dd>{backup.transactionCount ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt>Schema</dt>
                  <dd>{backup.schemaVersion ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatTimestamp(backup.createdAt)}</dd>
                </div>
              </dl>

              {backup.errorMessage && <p className="holding-note">{backup.errorMessage}</p>}

              <div className="backup-item-actions">
                <button
                  type="button"
                  onClick={() => handleRestoreClick(backup.fileName)}
                  disabled={restoreBackupMutation.isPending || !backup.isReadable}
                >
                  {restoreBackupMutation.isPending ? 'Restoring...' : 'Restore backup'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(feedback || actionError || runBackupMutation.error || restoreBackupMutation.error) && (
        <div className="overview-notes">
          {feedback && <p className="muted-copy">{feedback}</p>}
          {(actionError || runBackupMutation.error || restoreBackupMutation.error) && (
            <p className="form-error">
              {actionError ?? runBackupMutation.error?.message ?? restoreBackupMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}
