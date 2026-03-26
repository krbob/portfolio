import { useState } from 'react'
import { Card, SectionHeader } from './ui'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import {
  useDownloadPortfolioBackup,
  usePortfolioBackups,
  useRestorePortfolioBackup,
  useRunPortfolioBackup,
} from '../hooks/use-write-model'
import { missingDataLabel } from '../lib/availability'
import { formatBytes, formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { formatAuditEventMessage, formatAuditEventTitle } from '../lib/audit-copy'
import { labelAuditOutcome } from '../lib/labels'
import { label as labelClass, btnPrimary, btnSecondary, badge, badgeVariants, filterInput } from '../lib/styles'

export function PortfolioBackupsSection() {
  const { isPolish } = useI18n()
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
      setFeedback(
        isPolish
          ? `Utworzono kopię zapasową ${result.fileName} z ${result.accountCount} kontami, ${result.appPreferenceCount} ustawieniami aplikacji, ${result.instrumentCount} instrumentami, ${result.targetCount} celami, ${result.transactionCount} transakcjami i ${result.importProfileCount} profilami importu.`
          : `Created backup ${result.fileName} with ${result.accountCount} accounts, ${result.appPreferenceCount} app settings, ${result.instrumentCount} instruments, ${result.targetCount} targets, ${result.transactionCount} transactions and ${result.importProfileCount} import profiles.`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isPolish ? 'Nie udało się utworzyć kopii zapasowej.' : 'Backup run failed.')
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
        isPolish
          ? `Przywrócono ${result.fileName} w trybie ${result.mode}: ${result.accountCount} kont, ${result.appPreferenceCount} ustawień aplikacji, ${result.instrumentCount} instrumentów, ${result.targetCount} celów, ${result.transactionCount} transakcji i ${result.importProfileCount} profili importu.${result.safetyBackupFileName ? ` Kopia bezpieczeństwa: ${result.safetyBackupFileName}.` : ''}`
          : `Restored ${result.fileName} in ${result.mode} mode: ${result.accountCount} accounts, ${result.appPreferenceCount} app settings, ${result.instrumentCount} instruments, ${result.targetCount} targets, ${result.transactionCount} transactions and ${result.importProfileCount} import profiles.${result.safetyBackupFileName ? ` Safety backup: ${result.safetyBackupFileName}.` : ''}`,
      )
      setRestoreConfirmation('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isPolish ? 'Odtwarzanie nie powiodło się.' : 'Restore failed.')
    }
  }

  async function handleDownloadClick(fileName: string) {
    setFeedback(null)
    setActionError(null)

    try {
      const downloadedFileName = await downloadBackupMutation.mutateAsync(fileName)
      setFeedback(isPolish ? `Pobrano ${downloadedFileName}.` : `Downloaded ${downloadedFileName}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : isPolish ? 'Pobieranie nie powiodło się.' : 'Download failed.')
    }
  }

  const backups = backupsQuery.data?.backups ?? []
  const backupEvents = backupEventsQuery.data ?? []
  const visibleBackupEvents =
    backupOutcomeFilter === 'ALL' ? backupEvents : backupEvents.filter((event) => event.outcome === backupOutcomeFilter)

  return (
    <Card>
      <SectionHeader
        eyebrow={isPolish ? 'Kopie zapasowe' : 'Backups'}
        title={isPolish ? 'Kopie zapasowe serwera' : 'Server snapshots'}
        description={
          isPolish
            ? 'Przechowuj na serwerze pełne kopie zapasowe w JSON-ie z celami, ustawieniami aplikacji i profilami importu, uruchamiaj je na żądanie i przywracaj sprawdzony stan bez pobierania plików.'
            : 'Keep canonical JSON backups on the server, including targets, app settings and import profiles, trigger them on demand, and restore a known-good state without downloading files first.'
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Harmonogram' : 'Scheduler'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data?.schedulerEnabled ? (isPolish ? 'Włączony' : 'Enabled') : isPolish ? 'Tylko ręcznie' : 'Manual only'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Interwał' : 'Interval'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? `${backupsQuery.data.intervalMinutes} min` : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Retencja' : 'Retention'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? `${backupsQuery.data.retentionCount} ${isPolish ? 'plików' : 'files'}` : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Zapisane kopie' : 'Stored backups'}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? backups.length : '...'}</strong>
        </article>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>{isPolish ? 'Tryb odtwarzania' : 'Restore mode'}</span>
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
            <span className={labelClass}>{isPolish ? 'Wpisz REPLACE' : 'Type REPLACE'}</span>
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
          {runBackupMutation.isPending ? (isPolish ? 'Uruchamianie...' : 'Running...') : isPolish ? 'Utwórz kopię teraz' : 'Run backup now'}
        </button>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm text-zinc-500">{isPolish ? 'Katalog' : 'Directory'}: {backupsQuery.data?.directory ?? (isPolish ? 'Ładowanie...' : 'Loading...')}</p>
        <p className="text-sm text-zinc-500">
          {isPolish
            ? '`REPLACE` wymaga wpisania `REPLACE` i automatycznie tworzy kopię bezpieczeństwa.'
            : '`REPLACE` restore requires typing `REPLACE` and creates a safety backup automatically.'}
        </p>
        <p className="text-sm text-zinc-500">
          {isPolish ? 'Ostatni sukces' : 'Last success'}:{' '}
          {backupsQuery.data?.lastSuccessAt
            ? formatDateTime(backupsQuery.data.lastSuccessAt)
            : isPolish
              ? 'Brak udanej kopii zapasowej.'
              : 'No successful backup yet.'}
        </p>
        {backupsQuery.data?.lastFailureMessage && (
          <p className="text-sm text-red-400">
            {isPolish ? 'Ostatni błąd' : 'Last failure'}:{' '}
            {backupsQuery.data.lastFailureAt ? `${formatDateTime(backupsQuery.data.lastFailureAt)}: ` : ''}
            {backupsQuery.data.lastFailureMessage}
          </p>
        )}
      </div>

      {backupsQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie kopii zapasowych serwera...' : 'Loading server backups...'}</p>}
      {backupsQuery.isError && <p className="text-sm text-red-400">{backupsQuery.error.message}</p>}

      {!backupsQuery.isLoading && !backupsQuery.isError && (
        <div className="space-y-3 mb-4">
          {backups.length === 0 && <p className="text-sm text-zinc-500">{isPolish ? 'Nie utworzono jeszcze żadnej kopii zapasowej na serwerze.' : 'No server backups have been created yet.'}</p>}

          {backups.map((backup) => (
            <article key={backup.fileName} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{backup.fileName}</h4>
                  <p className="text-sm text-zinc-500">
                    {isPolish ? 'Wyeksportowano' : 'Exported'} {backup.exportedAt ? formatDateTime(backup.exportedAt) : isPolish ? 'nieznane' : 'unknown'} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>

                <span className={`${badge} ${backup.isReadable ? badgeVariants.success : badgeVariants.error}`}>
                  {backup.isReadable ? (isPolish ? 'GOTOWY' : 'READY') : isPolish ? 'USZKODZONY' : 'BROKEN'}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-8">
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Konta' : 'Accounts'}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.accountCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Ustawienia' : 'App settings'}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.appPreferenceCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Instrumenty' : 'Instruments'}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.instrumentCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Cele' : 'Targets'}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.targetCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Transakcje' : 'Transactions'}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.transactionCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Profile importu' : 'Import profiles'}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.importProfileCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Schemat' : 'Schema'}</dt>
                  <dd className="text-zinc-100">{backup.schemaVersion ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{isPolish ? 'Utworzono' : 'Created'}</dt>
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
                  {downloadBackupMutation.isPending
                    ? isPolish
                      ? 'Pobieranie...'
                      : 'Downloading...'
                    : isPolish
                      ? 'Pobierz JSON'
                      : 'Download JSON'}
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
                  {restoreBackupMutation.isPending
                    ? isPolish
                      ? 'Odtwarzanie...'
                      : 'Restoring...'
                    : isPolish
                      ? 'Przywróć kopię'
                      : 'Restore backup'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <SectionHeader
        eyebrow={isPolish ? 'Audyt' : 'Audit'}
        title={isPolish ? 'Aktywność kopii zapasowych' : 'Backup activity'}
        description={
          isPolish
            ? 'Ostatnie uruchomienia kopii zapasowych, odtworzenia i zdarzenia retencji z niezmienialnego dziennika audytu.'
            : 'Recent backup runs, restores and retention pruning events from the append-only audit log.'
        }
        className="mb-4 mt-8"
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>{isPolish ? 'Wynik' : 'Outcome'}</span>
          <select className={filterInput} value={backupOutcomeFilter} onChange={(event) => setBackupOutcomeFilter(event.target.value as 'ALL' | 'SUCCESS' | 'FAILURE')}>
            <option value="ALL">{labelAuditOutcome('ALL')}</option>
            <option value="SUCCESS">{labelAuditOutcome('SUCCESS')}</option>
            <option value="FAILURE">{labelAuditOutcome('FAILURE')}</option>
          </select>
        </div>
      </div>

      {backupEventsQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie aktywności kopii zapasowych...' : 'Loading backup activity...'}</p>}
      {backupEventsQuery.isError && <p className="text-sm text-red-400">{backupEventsQuery.error.message}</p>}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length === 0 && (
        <p className="text-sm text-zinc-500">{isPolish ? 'Brak jeszcze zdarzeń audytu związanych z kopiami zapasowymi.' : 'No backup-related audit events yet.'}</p>
      )}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length > 0 && (
        <div className="space-y-3">
          {visibleBackupEvents.map((event) => (
            <article className="rounded-lg border border-zinc-800/50 p-4" key={event.id}>
              <div className="flex items-start justify-between">
                    <div>
                      <strong className="text-sm text-zinc-100">{formatAuditEventTitle(event.action, isPolish)}</strong>
                      <p className="text-sm text-zinc-500">
                        {formatAuditEventMessage(event, isPolish)} · {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                    <span className={`${badge} ${event.outcome === 'FAILURE' ? badgeVariants.error : badgeVariants.success}`}>
                      {labelAuditOutcome(event.outcome)}
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
    </Card>
  )
}
