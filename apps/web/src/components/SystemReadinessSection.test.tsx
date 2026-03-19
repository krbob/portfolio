import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SystemReadinessSection } from './SystemReadinessSection'
import { useAppReadiness } from '../hooks/use-app-readiness'

vi.mock('../hooks/use-app-readiness', () => ({
  useAppReadiness: vi.fn(),
}))

describe('SystemReadinessSection', () => {
  it('renders readiness checks and summary', () => {
    vi.mocked(useAppReadiness).mockReturnValue({
      data: {
        status: 'DEGRADED',
        checkedAt: '2026-03-13T12:00:00Z',
        checks: [
          {
            key: 'sqlite-directory',
            label: 'SQLite directory',
            status: 'PASS',
            message: 'Using portfolio.db in /srv/portfolio/data.',
          },
          {
            key: 'backups-directory',
            label: 'Backups',
            status: 'WARN',
            message: 'Backups enabled in /srv/portfolio/backups with retention 14.',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAppReadiness>)

    render(<SystemReadinessSection />)

    expect(screen.getByRole('heading', { name: /runtime readiness/i })).toBeInTheDocument()
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    expect(screen.getByText('Backups')).toBeInTheDocument()
    expect(screen.getByText('backups-directory')).toBeInTheDocument()
    expect(screen.getByText('WARN')).toBeInTheDocument()
    expect(screen.getByText(/backups enabled in \/srv\/portfolio\/backups with retention 14\./i)).toBeInTheDocument()
  })
})
