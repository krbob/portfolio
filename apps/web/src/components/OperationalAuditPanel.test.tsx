import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OperationalAuditPanel } from './OperationalAuditPanel'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'

vi.mock('../hooks/use-read-model', () => ({
  usePortfolioAuditEvents: vi.fn(),
}))

describe('OperationalAuditPanel', () => {
  it('filters the audit feed by category and impact', async () => {
    vi.mocked(usePortfolioAuditEvents).mockReturnValue({
      data: [
        {
          id: 'backup-1',
          category: 'BACKUPS',
          action: 'BACKUP_RESTORED',
          outcome: 'SUCCESS',
          entityType: 'BACKUP',
          entityId: 'portfolio-backup-1.json',
          message: 'Restored backup portfolio-backup-1.json in REPLACE mode.',
          metadata: {
            mode: 'REPLACE',
            safetyBackupFileName: 'portfolio-safety-1.json',
          },
          occurredAt: '2026-03-13T18:00:00Z',
        },
        {
          id: 'import-1',
          category: 'IMPORTS',
          action: 'TRANSACTION_BATCH_IMPORTED',
          outcome: 'SUCCESS',
          entityType: 'TRANSACTION_BATCH',
          entityId: null,
          message: 'Imported 5 transaction rows.',
          metadata: {
            createdCount: '5',
          },
          occurredAt: '2026-03-13T17:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof usePortfolioAuditEvents>)

    render(<OperationalAuditPanel />)

    expect(screen.getByText('Events in window')).toBeInTheDocument()
    expect(screen.getByText(/restored backup portfolio-backup-1\.json in replace mode\./i)).toBeInTheDocument()
    expect(screen.getByText(/imported 5 transaction rows\./i)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Category'), 'BACKUPS')

    expect(screen.getByText(/restored backup portfolio-backup-1\.json in replace mode\./i)).toBeInTheDocument()
    expect(screen.queryByText(/imported 5 transaction rows\./i)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Impact'), 'HIGH_IMPACT_ONLY')

    expect(screen.getByText(/safety backup portfolio-safety-1\.json/i)).toBeInTheDocument()
    expect(screen.getByText('HIGH IMPACT')).toBeInTheDocument()
  })
})
