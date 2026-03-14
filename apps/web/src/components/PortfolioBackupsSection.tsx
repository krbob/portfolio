import { useState } from 'react'
import { SectionCard } from './SectionCard'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import {
  useDownloadPortfolioBackup,
  usePortfolioBackups,
  useRestorePortfolioBackup,
  useRunPortfolioBackup,
} from '../hooks/use-write-model'

export function PortfolioBackupsSection() {
  const backupsQuery = usePortfolioBackups()
  const backupEventsQuery = usePortfolioAuditEvents({ limit: 10, category: 'BACKUPS' })
  const downloadBackupMutation = useDownloadPortfolioBackup()
  const runBackupMutation = useRunPortfolioBackup()
  const restoreBackupMutation = useRestorePortfolioBackup()

  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE')
  const [restoreConfirmation, setRestoreConfirmation] = useState('')
  const [backupOutcomeFilter, setBackupOutcomeFilter] = useState<'ALL' | 'SUCCESS' | 'FAILURE'>('ALL')
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

    try {
      const result = await restoreBackupMutation.mutateAsync({
        fileName,
        mode: restoreMode,
        confirmation: restoreMode === 'REPLACE' ? restoreConfirmation : undefined,
      })
      setFeedback(
        `Restored ${result.fileName} in ${result.mode} mode: ${result.accountCount} accounts, ${result.instrumentCount} instruments, ${result.transactionCount} transactions.${result.safetyBackupFileName ? ` Safety backup: ${result.safetyBackupFileName}.` : ''}`,
      )
      setRestoreConfirmation('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Restore failed.')
    }
  }

  async function handleDownloadClick(fileName: string) {
    setFeedback(null)
    setActionError(null)

    try {
      const downloadedFileName = await downloadBackupMutation.mutateAsync(fileName)
      setFeedback(`Downloaded ${downloadedFileName}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Download failed.')
    }
  }

  const backups = backupsQuery.data?.backups ?? []
  const backupEvents = backupEventsQuery.data ?? []
  const visibleBackupEvents =
    backupOutcomeFilter === 'ALL' ? backupEvents : backupEvents.filter((event) => event.outcome === backupOutcomeFilter)

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
          <select
            value={restoreMode}
            onChange={(event) => {
              setRestoreMode(event.target.value as 'MERGE' | 'REPLACE')
              setRestoreConfirmation('')
            }}
          >
            <option value="MERGE">MERGE</option>
            <option value="REPLACE">REPLACE</option>
          </select>
        </label>

        {restoreMode === 'REPLACE' && (
          <label className="journal-filter">
            <span>Type REPLACE</span>
            <input
              type="text"
              value={restoreConfirmation}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
              placeholder="REPLACE"
            />
          </label>
        )}

        <div className="form-actions">
          <button type="button" onClick={handleRunBackupClick} disabled={runBackupMutation.isPending || backupsQuery.isLoading}>
            {runBackupMutation.isPending ? 'Running...' : 'Run backup now'}
          </button>
        </div>
      </div>

      <div className="overview-notes">
        <p className="muted-copy">Directory: {backupsQuery.data?.directory ?? 'Loading...'}</p>
        <p className="muted-copy">`REPLACE` restore requires typing `REPLACE` and creates a safety backup automatically.</p>
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
                  className="button-secondary"
                  onClick={() => handleDownloadClick(backup.fileName)}
                  disabled={downloadBackupMutation.isPending}
                >
                  {downloadBackupMutation.isPending ? 'Downloading...' : 'Download JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRestoreClick(backup.fileName)}
                  disabled={
                    restoreBackupMutation.isPending ||
                    !backup.isReadable ||
                    (restoreMode === 'REPLACE' && restoreConfirmation.trim().toUpperCase() !== 'REPLACE')
                  }
                >
                  {restoreBackupMutation.isPending ? 'Restoring...' : 'Restore backup'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="section-header">
        <p className="eyebrow">Audit</p>
        <h4>Backup activity</h4>
        <p>Recent backup runs, restores and retention pruning events from the append-only audit log.</p>
      </div>

      <div className="backup-toolbar">
        <label className="journal-filter">
          <span>Outcome</span>
          <select value={backupOutcomeFilter} onChange={(event) => setBackupOutcomeFilter(event.target.value as 'ALL' | 'SUCCESS' | 'FAILURE')}>
            <option value="ALL">ALL</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </label>
      </div>

      {backupEventsQuery.isLoading && <p className="muted-copy">Loading backup activity...</p>}
      {backupEventsQuery.isError && <p className="form-error">{backupEventsQuery.error.message}</p>}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length === 0 && (
        <p className="muted-copy">No backup-related audit events yet.</p>
      )}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length > 0 && (
        <div className="audit-feed">
          {visibleBackupEvents.map((event) => (
            <article className="audit-event" key={event.id}>
              <div className="audit-event-header">
                <div>
                  <strong>{event.message}</strong>
                  <p>
                    {event.action} · {formatTimestamp(event.occurredAt)}
                  </p>
                </div>
                <span className={`status-badge ${event.outcome === 'FAILURE' ? 'status-unavailable' : 'status-valued'}`}>
                  {event.outcome}
                </span>
              </div>
              {event.entityId && <p className="audit-event-entity">{event.entityId}</p>}
            </article>
          ))}
        </div>
      )}

      {(feedback || actionError || downloadBackupMutation.error || runBackupMutation.error || restoreBackupMutation.error) && (
        <div className="overview-notes">
          {feedback && <p className="muted-copy">{feedback}</p>}
          {(actionError || downloadBackupMutation.error || runBackupMutation.error || restoreBackupMutation.error) && (
            <p className="form-error">
              {actionError ??
                downloadBackupMutation.error?.message ??
                runBackupMutation.error?.message ??
                restoreBackupMutation.error?.message}
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
