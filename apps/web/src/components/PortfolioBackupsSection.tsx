import { useState } from 'react'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import {
  useDownloadPortfolioBackup,
  usePortfolioBackups,
  useRestorePortfolioBackup,
  useRunPortfolioBackup,
} from '../hooks/use-write-model'
import { formatBytes, formatDateTime } from '../lib/format'
import { card, label as labelClass, btnPrimary, btnSecondary, badge, badgeVariants, filterInput } from '../lib/styles'

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
    <div className={card}>
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Backups</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-100">Server snapshots</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Keep canonical JSON backups on the server, trigger them on demand, and restore a known-good state without downloading files first.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Scheduler</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data?.schedulerEnabled ? 'Enabled' : 'Manual only'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Interval</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? `${backupsQuery.data.intervalMinutes} min` : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Retention</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? `${backupsQuery.data.retentionCount} files` : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">Stored backups</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? backups.length : '...'}</strong>
        </article>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>Restore mode</span>
          <select
            className={filterInput}
            value={restoreMode}
            onChange={(event) => {
              setRestoreMode(event.target.value as 'MERGE' | 'REPLACE')
              setRestoreConfirmation('')
            }}
          >
            <option value="MERGE">MERGE</option>
            <option value="REPLACE">REPLACE</option>
          </select>
        </div>

        {restoreMode === 'REPLACE' && (
          <div>
            <span className={labelClass}>Type REPLACE</span>
            <input
              className={filterInput}
              type="text"
              value={restoreConfirmation}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
              placeholder="REPLACE"
            />
          </div>
        )}

        <button className={btnPrimary} type="button" onClick={handleRunBackupClick} disabled={runBackupMutation.isPending || backupsQuery.isLoading}>
          {runBackupMutation.isPending ? 'Running...' : 'Run backup now'}
        </button>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm text-zinc-500">Directory: {backupsQuery.data?.directory ?? 'Loading...'}</p>
        <p className="text-sm text-zinc-500">`REPLACE` restore requires typing `REPLACE` and creates a safety backup automatically.</p>
        <p className="text-sm text-zinc-500">
          Last success: {backupsQuery.data?.lastSuccessAt ? formatDateTime(backupsQuery.data.lastSuccessAt) : 'No successful backup yet.'}
        </p>
        {backupsQuery.data?.lastFailureMessage && (
          <p className="text-sm text-red-400">
            Last failure: {backupsQuery.data.lastFailureAt ? `${formatDateTime(backupsQuery.data.lastFailureAt)}: ` : ''}
            {backupsQuery.data.lastFailureMessage}
          </p>
        )}
      </div>

      {backupsQuery.isLoading && <p className="text-sm text-zinc-500">Loading server backups...</p>}
      {backupsQuery.isError && <p className="text-sm text-red-400">{backupsQuery.error.message}</p>}

      {!backupsQuery.isLoading && !backupsQuery.isError && (
        <div className="space-y-3 mb-4">
          {backups.length === 0 && <p className="text-sm text-zinc-500">No server backups have been created yet.</p>}

          {backups.map((backup) => (
            <article key={backup.fileName} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{backup.fileName}</h4>
                  <p className="text-sm text-zinc-500">
                    Exported {backup.exportedAt ? formatDateTime(backup.exportedAt) : 'unknown'} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>

                <span className={`${badge} ${backup.isReadable ? badgeVariants.success : badgeVariants.error}`}>
                  {backup.isReadable ? 'READY' : 'BROKEN'}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-5">
                <div>
                  <dt className="text-zinc-500">Accounts</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.accountCount ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Instruments</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.instrumentCount ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Transactions</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.transactionCount ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Schema</dt>
                  <dd className="text-zinc-100">{backup.schemaVersion ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Created</dt>
                  <dd className="text-zinc-100">{formatDateTime(backup.createdAt)}</dd>
                </div>
              </dl>

              {backup.errorMessage && <p className="mt-2 text-sm text-amber-400">{backup.errorMessage}</p>}

              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => handleDownloadClick(backup.fileName)}
                  disabled={downloadBackupMutation.isPending}
                >
                  {downloadBackupMutation.isPending ? 'Downloading...' : 'Download JSON'}
                </button>
                <button
                  type="button"
                  className={btnPrimary}
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

      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Audit</p>
        <h4 className="mt-1 text-base font-semibold text-zinc-100">Backup activity</h4>
        <p className="mt-1 text-sm text-zinc-500">Recent backup runs, restores and retention pruning events from the append-only audit log.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>Outcome</span>
          <select className={filterInput} value={backupOutcomeFilter} onChange={(event) => setBackupOutcomeFilter(event.target.value as 'ALL' | 'SUCCESS' | 'FAILURE')}>
            <option value="ALL">ALL</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </div>
      </div>

      {backupEventsQuery.isLoading && <p className="text-sm text-zinc-500">Loading backup activity...</p>}
      {backupEventsQuery.isError && <p className="text-sm text-red-400">{backupEventsQuery.error.message}</p>}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length === 0 && (
        <p className="text-sm text-zinc-500">No backup-related audit events yet.</p>
      )}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length > 0 && (
        <div className="space-y-3">
          {visibleBackupEvents.map((event) => (
            <article className="rounded-lg border border-zinc-800/50 p-4" key={event.id}>
              <div className="flex items-start justify-between">
                    <div>
                      <strong className="text-sm text-zinc-100">{event.message}</strong>
                      <p className="text-sm text-zinc-500">
                        {event.action} · {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                    <span className={`${badge} ${event.outcome === 'FAILURE' ? badgeVariants.error : badgeVariants.success}`}>
                      {event.outcome}
                    </span>
              </div>
              {event.entityId && <p className="mt-1 text-xs font-mono text-zinc-600">{event.entityId}</p>}
            </article>
          ))}
        </div>
      )}

      {(feedback || actionError || downloadBackupMutation.error || runBackupMutation.error || restoreBackupMutation.error) && (
        <div className="mt-4 space-y-1">
          {feedback && <p className="text-sm text-zinc-500">{feedback}</p>}
          {(actionError || downloadBackupMutation.error || runBackupMutation.error || restoreBackupMutation.error) && (
            <p className="text-sm text-red-400">
              {actionError ??
                downloadBackupMutation.error?.message ??
                runBackupMutation.error?.message ??
                restoreBackupMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
