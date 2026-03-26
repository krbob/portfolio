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
            details: {},
          },
          {
            key: 'stock-analyst',
            label: 'Stock Analyst',
            status: 'WARN',
            message: 'stock-analyst history returned HTTP 403 for symbol PLN=X.',
            details: {
              upstream: 'stock-analyst',
              operation: 'history',
              symbol: 'PLN=X',
              statusCode: '403',
              responseBodyPreview: '{"error":"Forbidden"}',
            },
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
    expect(screen.getByText('Stock Analyst')).toBeInTheDocument()
    expect(screen.getAllByText('stock-analyst').length).toBeGreaterThan(0)
    expect(screen.getByText('WARN')).toBeInTheDocument()
    expect(screen.getByText(/stock-analyst history returned http 403 for symbol pln=x\./i)).toBeInTheDocument()
    expect(screen.getByText('Upstream details')).toBeInTheDocument()
    expect(screen.getByText('HTTP status')).toBeInTheDocument()
    expect(screen.getByText('403')).toBeInTheDocument()
  })
})
