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
import { formatMessage, t } from '../lib/messages'
import { label as labelClass, btnPrimary, btnSecondary, badge, badgeVariants, filterInput } from '../lib/styles'
import type { PortfolioBackupStatus } from '../api/write-model'

type BackupProtectionState = 'PROTECTED' | 'PENDING' | 'UNPROTECTED' | 'UNKNOWN'

export function PortfolioBackupsSection() {
  const { language } = useI18n()
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
        formatMessage(t('backups.createdFeedback'), {
          fileName: result.fileName,
          accountCount: result.accountCount,
          appPreferenceCount: result.appPreferenceCount,
          instrumentCount: result.instrumentCount,
          targetCount: result.targetCount,
          transactionCount: result.transactionCount,
          importProfileCount: result.importProfileCount,
        }),
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
        formatMessage(t('backups.restoredFeedback'), {
          fileName: result.fileName,
          mode: result.mode,
          accountCount: result.accountCount,
          appPreferenceCount: result.appPreferenceCount,
          instrumentCount: result.instrumentCount,
          targetCount: result.targetCount,
          transactionCount: result.transactionCount,
          importProfileCount: result.importProfileCount,
          safetyBackup: result.safetyBackupFileName ? formatMessage(t('backups.safetyBackupSuffix'), { fileName: result.safetyBackupFileName }) : '',
        }),
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
      setFeedback(formatMessage(t('backups.downloadedFeedback'), { fileName: downloadedFileName }))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('backups.downloadFailed'))
    }
  }

  const backupStatus = backupsQuery.data
  const backups = backupStatus?.backups ?? []
  const backupEvents = backupEventsQuery.data ?? []
  const visibleBackupEvents =
    backupOutcomeFilter === 'ALL' ? backupEvents : backupEvents.filter((event) => event.outcome === backupOutcomeFilter)
  const protectionState = getBackupProtectionState(backupStatus)
  const protectionLabel = labelBackupProtectionState(protectionState)
  const protectionDescription = describeBackupProtection(backupStatus, protectionState)
  const protectionBadgeVariant = backupProtectionBadgeVariant(protectionState)
  const postChangeTiming = backupStatus?.postChangeDebounceSeconds != null && backupStatus.postChangeMaxDelaySeconds != null
    ? formatMessage(t('backups.postChangeTiming'), {
        debounce: formatBackupDelay(backupStatus.postChangeDebounceSeconds),
        maxDelay: formatBackupDelay(backupStatus.postChangeMaxDelaySeconds),
      })
    : null
  const retentionSummary = backupStatus?.postChangeRetentionCount != null && backupStatus.safetyRetentionDays != null
    ? formatMessage(t('backups.retentionBreakdown'), {
        periodic: backupStatus.retentionCount,
        postChange: backupStatus.postChangeRetentionCount,
        safetyDays: backupStatus.safetyRetentionDays,
      })
    : backupStatus ? `${backupStatus.retentionCount} ${t('backups.files')}` : '...'

  return (
    <Card>
      <SectionHeader
        eyebrow={t('backups.eyebrow')}
        title={t('backups.title')}
        description={t('backups.description')}
      />

      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-5">
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-400">{t('backups.protection')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {backupStatus ? (
              <span className={`${badge} ${protectionBadgeVariant}`}>{protectionLabel}</span>
            ) : '...'}
          </strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-400">{t('backups.scheduler')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {backupStatus
              ? backupStatus.schedulerEnabled ? t('backups.schedulerEnabled') : t('backups.schedulerManual')
              : '...'}
          </strong>
          {backupStatus && (
            <span className="mt-1 block text-xs text-zinc-400">
              {t('backups.interval')}: {`${backupStatus.intervalMinutes} min`}
            </span>
          )}
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-400">{t('backups.postChange')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">
            {backupStatus
              ? backupStatus.postChangeEnabled ? t('backups.postChangeEnabled') : t('backups.postChangeDisabled')
              : '...'}
          </strong>
          {postChangeTiming && <span className="mt-1 block text-xs text-zinc-400">{postChangeTiming}</span>}
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-400">{t('backups.retention')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{retentionSummary}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800/50 p-4">
          <span className="text-xs text-zinc-400">{t('backups.storedBackups')}</span>
          <strong className="mt-1 block text-sm text-zinc-100">{backupStatus ? backups.length : '...'}</strong>
        </article>
      </div>

      {backupStatus && (
        <div
          aria-live="polite"
          className={`mb-4 rounded-lg border p-4 ${
            protectionState === 'PROTECTED'
              ? 'border-ui-positive/30 bg-ui-positive/5'
              : protectionState === 'UNKNOWN'
                ? 'border-ui-border bg-ui-surface'
                : 'border-ui-highlight/30 bg-ui-highlight/5'
          }`}
          role="status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${badge} ${protectionBadgeVariant}`}>{protectionLabel}</span>
            <strong className="text-sm text-zinc-100">{t('backups.protection')}</strong>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{protectionDescription}</p>
        </div>
      )}

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
        <p className="text-sm text-zinc-400">{t('backups.directory')}: {backupStatus?.directory ?? `${t('common.loading')}...`}</p>
        <p className="text-sm text-zinc-400">
          {t('backups.replaceNotice')}
        </p>
        <p className="text-sm text-zinc-400">
          {t('backups.lastSuccess')}:{' '}
          {backupStatus?.lastSuccessAt
            ? formatDateTime(backupStatus.lastSuccessAt)
            : t('backups.noSuccessYet')}
        </p>
        {backupStatus?.lastFailureMessage && (
          <p className="text-sm text-red-400">
            {t('backups.lastFailure')}:{' '}
            {backupStatus.lastFailureAt ? `${formatDateTime(backupStatus.lastFailureAt)}: ` : ''}
            {backupStatus.lastFailureMessage}
          </p>
        )}
      </div>

      {backupsQuery.isLoading && <p className="text-sm text-zinc-400">{t('backups.loadingBackups')}</p>}
      {backupsQuery.isError && <p className="text-sm text-red-400">{backupsQuery.error.message}</p>}

      {!backupsQuery.isLoading && !backupsQuery.isError && (
        <div className="space-y-3 mb-4">
          {backups.length === 0 && <p className="text-sm text-zinc-400">{t('backups.noBackupsYet')}</p>}

          {backups.map((backup) => (
            <article key={backup.fileName} className="rounded-lg border border-zinc-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{backup.fileName}</h4>
                  <p className="text-sm text-zinc-400">
                    {t('backups.exported')} {backup.exportedAt ? formatDateTime(backup.exportedAt) : t('backups.unknown')} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <span className={`${badge} ${badgeVariants.info}`}>
                    {labelBackupTrigger(backup.trigger, backup.retentionClass)}
                  </span>
                  {backup.retentionClass && (
                    <span className={`${badge} ${badgeVariants.default}`}>
                      {labelBackupRetentionClass(backup.retentionClass)}
                    </span>
                  )}
                  <span className={`${badge} ${backup.isReadable ? badgeVariants.success : badgeVariants.error}`}>
                    {backup.isReadable ? t('backups.ready') : t('backups.broken')}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-8">
                <div>
                  <dt className="text-zinc-400">{t('backups.accounts')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.accountCount ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.appSettings')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.appPreferenceCount ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.instruments')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.instrumentCount ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.targets')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.targetCount ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.transactions')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.transactionCount ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.importProfilesLabel')}</dt>
                  <dd className="text-zinc-100 tabular-nums">{backup.importProfileCount ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.schema')}</dt>
                  <dd className="text-zinc-100">{backup.schemaVersion ?? missingDataLabel(language)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t('backups.created')}</dt>
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
        className="mb-4 mt-4"
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

      {backupEventsQuery.isLoading && <p className="text-sm text-zinc-400">{t('backups.loadingActivity')}</p>}
      {backupEventsQuery.isError && <p className="text-sm text-red-400">{backupEventsQuery.error.message}</p>}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length === 0 && (
        <p className="text-sm text-zinc-400">{t('backups.noAuditEvents')}</p>
      )}
      {!backupEventsQuery.isLoading && !backupEventsQuery.isError && visibleBackupEvents.length > 0 && (
        <div className="space-y-3">
          {visibleBackupEvents.map((event) => (
            <article className="rounded-lg border border-zinc-800/50 p-4" key={event.id}>
              <div className="flex items-start justify-between">
                    <div>
                      <strong className="text-sm text-zinc-100">{formatAuditEventTitle(event.action)}</strong>
                      <p className="text-sm text-zinc-400">
                        {formatAuditEventMessage(event, language)} · {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                    <span className={`${badge} ${event.outcome === 'FAILURE' ? badgeVariants.error : badgeVariants.success}`}>
                      {labelAuditOutcome(event.outcome)}
                    </span>
              </div>
              {event.entityId && <p className="mt-1 text-xs font-mono text-zinc-400">{event.entityId}</p>}
            </article>
          ))}
        </div>
      )}

      {(feedback || actionError || downloadBackupMutation.error || runBackupMutation.error || restoreBackupMutation.error) && (
        <div className="mt-4 space-y-1">
          {feedback && <p className="text-sm text-zinc-400">{feedback}</p>}
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

function getBackupProtectionState(status: PortfolioBackupStatus | undefined): BackupProtectionState {
  if (status?.hasUnprotectedChanges == null) {
    return 'UNKNOWN'
  }
  if (!status.hasUnprotectedChanges) {
    return 'PROTECTED'
  }
  return status.postChangeEnabled ? 'PENDING' : 'UNPROTECTED'
}

function labelBackupProtectionState(state: BackupProtectionState) {
  switch (state) {
    case 'PROTECTED':
      return t('backups.protected')
    case 'PENDING':
      return t('backups.pending')
    case 'UNPROTECTED':
      return t('backups.unprotected')
    case 'UNKNOWN':
      return t('backups.protectionUnknown')
  }
}

function describeBackupProtection(status: PortfolioBackupStatus | undefined, state: BackupProtectionState) {
  switch (state) {
    case 'PROTECTED':
      return status?.lastSuccessAt == null
        ? t('backups.noUnprotectedChangesDescription')
        : t('backups.protectedDescription')
    case 'PENDING':
      return status?.pendingSince && status.nextPostChangeBackupAt
        ? formatMessage(t('backups.pendingDescription'), {
            pendingSince: formatDateTime(status.pendingSince),
            nextBackupAt: formatDateTime(status.nextPostChangeBackupAt),
          })
        : t('backups.pendingDescriptionNoDate')
    case 'UNPROTECTED':
      return t('backups.disabledDescription')
    case 'UNKNOWN':
      return t('backups.protectionUnknownDescription')
  }
}

function backupProtectionBadgeVariant(state: BackupProtectionState) {
  switch (state) {
    case 'PROTECTED':
      return badgeVariants.success
    case 'PENDING':
      return badgeVariants.warning
    case 'UNPROTECTED':
      return badgeVariants.error
    case 'UNKNOWN':
      return badgeVariants.default
  }
}

function formatBackupDelay(seconds: number) {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`
}

function labelBackupTrigger(trigger: string | null | undefined, retentionClass: string | null | undefined) {
  switch (trigger) {
    case 'MANUAL':
      return t('backups.triggerManual')
    case 'SCHEDULED':
      return t('backups.triggerScheduled')
    case 'POST_CHANGE':
      return t('backups.triggerPostChange')
    case 'PRE_RESTORE_REPLACE':
      return t('backups.triggerPreRestore')
    case 'PRE_IMPORT_REPLACE':
      return t('backups.triggerPreImport')
    default:
      if (retentionClass === 'PERIODIC') {
        return t('backups.triggerLegacy')
      }
      if (retentionClass === 'UNMANAGED') {
        return t('backups.triggerUnmanaged')
      }
      return t('backups.triggerUnknown')
  }
}

function labelBackupRetentionClass(retentionClass: string) {
  switch (retentionClass) {
    case 'PERIODIC':
      return t('backups.retentionPeriodic')
    case 'POST_CHANGE':
      return t('backups.retentionPostChange')
    case 'SAFETY':
      return t('backups.retentionSafety')
    case 'UNMANAGED':
      return t('backups.retentionUnmanaged')
    default:
      return retentionClass
  }
}
