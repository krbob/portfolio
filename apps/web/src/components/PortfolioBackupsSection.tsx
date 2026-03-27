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
import { t } from '../lib/messages'
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
      setActionError(error instanceof Error ? error.message : t('backups.backupFailed'))
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
      setActionError(error instanceof Error ? error.message : t('backups.restoreFailed'))
    }
  }

  async function handleDownloadClick(fileName: string) {
    setFeedback(null)
    setActionError(null)

    try {
      const downloadedFileName = await downloadBackupMutation.mutateAsync(fileName)
      setFeedback(isPolish ? `Pobrano ${downloadedFileName}.` : `Downloaded ${downloadedFileName}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('backups.downloadFailed'))
    }
  }

  const backups = backupsQuery.data?.backups ?? []
  const backupEvents = backupEventsQuery.data ?? []
  const visibleBackupEvents =
    backupOutcomeFilter === 'ALL' ? backupEvents : backupEvents.filter((event) => event.outcome === backupOutcomeFilter)

  return (
    <Card>
      <SectionHeader
        eyebrow={t('backups.eyebrow')}
        title={t('backups.title')}
        description={t('backups.description')}
      />

      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('backups.scheduler')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data?.schedulerEnabled ? t('backups.schedulerEnabled') : t('backups.schedulerManual')}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('backups.interval')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? `${backupsQuery.data.intervalMinutes} min` : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('backups.retention')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? `${backupsQuery.data.retentionCount} ${t('backups.files')}` : '...'}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-500">{t('backups.storedBackups')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupsQuery.data ? backups.length : '...'}</strong>
        </article>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>{t('backups.restoreMode')}</span>
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
            <span className={labelClass}>{t('backups.typeReplace')}</span>
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
          {runBackupMutation.isPending ? t('backups.running') : t('backups.runNow')}
        </button>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-sm text-zinc-500">{t('backups.directory')}: {backupsQuery.data?.directory ?? (isPolish ? 'Ładowanie...' : 'Loading...')}</p>
        <p className="text-sm text-zinc-500">
          {t('backups.replaceNotice')}
        </p>
        <p className="text-sm text-zinc-500">
          {t('backups.lastSuccess')}:{' '}
          {backupsQuery.data?.lastSuccessAt
            ? formatDateTime(backupsQuery.data.lastSuccessAt)
            : t('backups.noSuccessYet')}
        </p>
        {backupsQuery.data?.lastFailureMessage && (
          <p className="text-sm text-red-400">
            {t('backups.lastFailure')}:{' '}
            {backupsQuery.data.lastFailureAt ? `${formatDateTime(backupsQuery.data.lastFailureAt)}: ` : ''}
            {backupsQuery.data.lastFailureMessage}
          </p>
        )}
      </div>

      {backupsQuery.isLoading && <p className="text-sm text-zinc-500">{t('backups.loadingBackups')}</p>}
      {backupsQuery.isError && <p className="text-sm text-red-400">{backupsQuery.error.message}</p>}

      {!backupsQuery.isLoading && !backupsQuery.isError && (
        <div className="space-y-3 mb-4">
          {backups.length === 0 && <p className="text-sm text-zinc-500">{t('backups.noBackupsYet')}</p>}

          {backups.map((backup) => (
            <article key={backup.fileName} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{backup.fileName}</h4>
                  <p className="text-sm text-zinc-500">
                    {t('backups.exported')} {backup.exportedAt ? formatDateTime(backup.exportedAt) : t('backups.unknown')} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>

                <span className={`${badge} ${backup.isReadable ? badgeVariants.success : badgeVariants.error}`}>
                  {backup.isReadable ? t('backups.ready') : t('backups.broken')}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-8">
                <div>
                  <dt className="text-zinc-500">{t('backups.accounts')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.accountCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.appSettings')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.appPreferenceCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.instruments')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.instrumentCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.targets')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.targetCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.transactions')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.transactionCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.importProfilesLabel')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.importProfileCount ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.schema')}</dt>
                  <dd className="text-zinc-100">{backup.schemaVersion ?? missingDataLabel(isPolish)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{t('backups.created')}</dt>
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
                    ? t('backups.downloading')
                    : t('backups.downloadJson')}
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
                    ? t('backups.restoring')
                    : t('backups.restoreBackup')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <SectionHeader
        eyebrow={t('backups.auditEyebrow')}
        title={t('backups.auditTitle')}
        description={t('backups.auditDescription')}
        className="mb-4 mt-8"
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <span className={labelClass}>{t('backups.outcome')}</span>
          <select className={filterInput} value={backupOutcomeFilter} onChange={(event) => setBackupOutcomeFilter(event.target.value as 'ALL' | 'SUCCESS' | 'FAILURE')}>
            <option value="ALL">{labelAuditOutcome('ALL')}</option>
            <option value="SUCCESS">{labelAuditOutcome('SUCCESS')}</option>
            <option value="FAILURE">{labelAuditOutcome('FAILURE')}</option>
          </select>
        </div>
      </div>

      {backupEventsQuery.isLoading && <p className="text-sm text-zinc-500">{t('backups.loadingActivity')}</p>}
      {backupEventsQuery.isError && <p className="text-sm text-red-400">{backupEventsQuery.error.message}</p>}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length === 0 && (
        <p className="text-sm text-zinc-500">{t('backups.noAuditEvents')}</p>
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
