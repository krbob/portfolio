import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortfolioBackupsSection } from './PortfolioBackupsSection'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import {
  useDownloadPortfolioBackup,
  usePortfolioBackups,
  useRestorePortfolioBackup,
  useRunPortfolioBackup,
} from '../hooks/use-write-model'
import { I18nProvider } from '../lib/i18n'
import type { PortfolioBackupStatus } from '../api/write-model'

vi.mock('../hooks/use-read-model', () => ({
  usePortfolioAuditEvents: vi.fn(),
}))

vi.mock('../hooks/use-write-model', () => ({
  useDownloadPortfolioBackup: vi.fn(),
  usePortfolioBackups: vi.fn(),
  useRestorePortfolioBackup: vi.fn(),
  useRunPortfolioBackup: vi.fn(),
}))

describe('PortfolioBackupsSection', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.mocked(usePortfolioAuditEvents).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof usePortfolioAuditEvents>)
    vi.mocked(useDownloadPortfolioBackup).mockReturnValue(
      idleMutation() as unknown as ReturnType<typeof useDownloadPortfolioBackup>,
    )
    vi.mocked(useRunPortfolioBackup).mockReturnValue(
      idleMutation() as unknown as ReturnType<typeof useRunPortfolioBackup>,
    )
    vi.mocked(useRestorePortfolioBackup).mockReturnValue(
      idleMutation() as unknown as ReturnType<typeof useRestorePortfolioBackup>,
    )
  })

  it('shows a protected canonical state and the class-specific backup policy', () => {
    mockBackupStatus(backupStatus({
      hasUnprotectedChanges: false,
      backups: [backupRecord({ retentionClass: 'PERIODIC' })],
    }))

    renderSection()

    expect(screen.getAllByText('PROTECTED')).toHaveLength(2)
    expect(screen.getByText('The current canonical state is covered by the latest readable backup.')).toBeInTheDocument()
    expect(screen.getByText('2 min quiet period · due threshold 10 min')).toBeInTheDocument()
    expect(screen.getByText('30 periodic · 10 post-change · safety 30 days')).toBeInTheDocument()
  })

  it('does not imply that an empty portfolio already has a backup', () => {
    mockBackupStatus(backupStatus({
      hasUnprotectedChanges: false,
      lastRunAt: null,
      lastSuccessAt: null,
      backups: [],
    }))

    renderSection()

    expect(screen.getByText('There are no unprotected canonical changes. An empty portfolio does not need a backup yet.')).toBeInTheDocument()
    expect(screen.queryByText('The current canonical state is covered by the latest readable backup.')).not.toBeInTheDocument()
  })

  it('shows when canonical changes are waiting for their automatic backup', () => {
    mockBackupStatus(backupStatus({
      hasUnprotectedChanges: true,
      pendingSince: '2026-09-01T10:05:00Z',
      nextPostChangeBackupAt: '2026-09-01T10:07:00Z',
      backups: [
        {
          fileName: 'portfolio-backup-post-change-20260901T100000000Z.json',
          trigger: 'POST_CHANGE',
          retentionClass: 'POST_CHANGE',
          createdAt: '2026-09-01T10:00:00Z',
          exportedAt: '2026-09-01T10:00:00Z',
          sizeBytes: 2048,
          schemaVersion: 5,
          accountCount: 1,
          appPreferenceCount: 2,
          instrumentCount: 1,
          targetCount: 3,
          transactionCount: 8,
          importProfileCount: 1,
          isReadable: true,
          errorMessage: null,
        },
      ],
    }))

    renderSection()

    expect(screen.getAllByText('BACKUP PENDING')).toHaveLength(2)
    expect(screen.getByText(/changes since .+ are not protected yet\. an automatic backup becomes due at .+; the worker checks periodically\./i)).toBeInTheDocument()
    expect(screen.getByText('After canonical change')).toBeInTheDocument()
    expect(screen.getByText('Post-change retention')).toBeInTheDocument()
    expect(screen.getByText('READY')).toBeInTheDocument()
  })

  it('makes an unprotected state actionable when automatic post-change backups are disabled', () => {
    mockBackupStatus(backupStatus({
      postChangeEnabled: false,
      hasUnprotectedChanges: true,
      pendingSince: '2026-09-01T10:05:00Z',
      nextPostChangeBackupAt: null,
    }))

    renderSection()

    expect(screen.getAllByText('UNPROTECTED')).toHaveLength(2)
    expect(screen.getByText(/automatic post-change backups are disabled\. run a backup now\./i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run backup now' })).toBeEnabled()
  })

  it('does not claim protection when connected to an older API without coverage fields', () => {
    const legacyStatus = backupStatus({ hasUnprotectedChanges: false })
    delete legacyStatus.hasUnprotectedChanges
    delete legacyStatus.postChangeEnabled
    mockBackupStatus(legacyStatus)

    renderSection()

    expect(screen.getAllByText('UNKNOWN')).toHaveLength(2)
    expect(screen.getByText(/this api version does not yet report whether current changes are covered/i)).toBeInTheDocument()
  })

  it('distinguishes legacy periodic backups from unmanaged JSON files', () => {
    mockBackupStatus(backupStatus({
      backups: [
        backupRecord({
          fileName: 'portfolio-backup-20260901T100000000Z.json',
          trigger: null,
          retentionClass: 'PERIODIC',
        }),
        backupRecord({
          fileName: 'admin-export.json',
          trigger: null,
          retentionClass: 'UNMANAGED',
        }),
      ],
    }))

    renderSection()

    expect(screen.getByText('Legacy backup')).toBeInTheDocument()
    expect(screen.getByText('Unmanaged file')).toBeInTheDocument()
  })
})

function renderSection() {
  return render(
    <I18nProvider localeOverride="en-GB">
      <PortfolioBackupsSection />
    </I18nProvider>,
  )
}

function mockBackupStatus(status: PortfolioBackupStatus) {
  vi.mocked(usePortfolioBackups).mockReturnValue({
    data: status,
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof usePortfolioBackups>)
}

function backupStatus(overrides: Partial<PortfolioBackupStatus> = {}): PortfolioBackupStatus {
  return {
    schedulerEnabled: true,
    directory: '/srv/portfolio/backups',
    intervalMinutes: 1440,
    retentionCount: 30,
    postChangeEnabled: true,
    postChangeDebounceSeconds: 120,
    postChangeMaxDelaySeconds: 600,
    postChangeRetentionCount: 10,
    safetyRetentionDays: 30,
    hasUnprotectedChanges: false,
    pendingSince: null,
    nextPostChangeBackupAt: null,
    running: false,
    lastRunAt: '2026-09-01T10:00:00Z',
    lastSuccessAt: '2026-09-01T10:00:00Z',
    lastFailureAt: null,
    lastFailureMessage: null,
    backups: [],
    ...overrides,
  }
}

function backupRecord(overrides: Partial<PortfolioBackupStatus['backups'][number]> = {}): PortfolioBackupStatus['backups'][number] {
  return {
    fileName: 'portfolio-backup-manual-20260901T100000000Z.json',
    trigger: 'MANUAL',
    retentionClass: 'PERIODIC',
    createdAt: '2026-09-01T10:00:00Z',
    exportedAt: '2026-09-01T10:00:00Z',
    sizeBytes: 2048,
    schemaVersion: 5,
    accountCount: 1,
    appPreferenceCount: 2,
    instrumentCount: 1,
    targetCount: 3,
    transactionCount: 8,
    importProfileCount: 1,
    isReadable: true,
    errorMessage: null,
    ...overrides,
  }
}

function idleMutation() {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }
}
