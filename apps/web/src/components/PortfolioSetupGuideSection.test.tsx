import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortfolioSetupGuideSection } from './PortfolioSetupGuideSection'
import { useAppReadiness } from '../hooks/use-app-readiness'
import { usePortfolioDataQuality } from '../hooks/use-portfolio-data-quality'
import {
  useAccounts,
  useInstruments,
  usePortfolioBenchmarkSettings,
  usePortfolioTargets,
  useTransactions,
} from '../hooks/use-write-model'

vi.mock('../hooks/use-app-readiness', () => ({
  useAppReadiness: vi.fn(),
}))

vi.mock('../hooks/use-portfolio-data-quality', () => ({
  usePortfolioDataQuality: vi.fn(),
}))

vi.mock('../hooks/use-write-model', () => ({
  useAccounts: vi.fn(),
  useInstruments: vi.fn(),
  usePortfolioBenchmarkSettings: vi.fn(),
  usePortfolioTargets: vi.fn(),
  useTransactions: vi.fn(),
}))

describe('PortfolioSetupGuideSection', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('stays hidden when the only issue is an advisory readiness warning', () => {
    mockConfiguredPortfolio()
    vi.mocked(useAppReadiness).mockReturnValue({
      data: {
        status: 'DEGRADED',
        checkedAt: '2026-04-13T05:19:32.922880429Z',
        checks: [
          {
            key: 'stock-analyst',
            label: 'Stock Analyst',
            status: 'WARN',
            message: 'Stock Analyst probe timed out after 2500 ms.',
            details: {
              upstream: 'stock-analyst',
              operation: 'history',
              symbol: 'PLN=X',
              timeoutMs: '2500',
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAppReadiness>)

    render(
      <MemoryRouter>
        <PortfolioSetupGuideSection />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: /next steps/i })).not.toBeInTheDocument()
  })

  it('surfaces readiness as attention when there is a blocking failure', () => {
    mockConfiguredPortfolio()
    vi.mocked(useAppReadiness).mockReturnValue({
      data: {
        status: 'NOT_READY',
        checkedAt: '2026-04-13T05:19:32.922880429Z',
        checks: [
          {
            key: 'sqlite-connection',
            label: 'SQLite connection',
            status: 'FAIL',
            message: 'Failed to connect to SQLite.',
            details: {},
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAppReadiness>)

    render(
      <MemoryRouter>
        <PortfolioSetupGuideSection />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /next steps/i })).toBeInTheDocument()
    expect(screen.getByText(/runtime readiness/i)).toBeInTheDocument()
    expect(screen.getByText(/resolve runtime blockers or warnings first/i)).toBeInTheDocument()
  })
})

function mockConfiguredPortfolio() {
  vi.mocked(useAccounts).mockReturnValue({
    data: [{}],
    isLoading: false,
  } as unknown as ReturnType<typeof useAccounts>)
  vi.mocked(useInstruments).mockReturnValue({
    data: [{}],
    isLoading: false,
  } as unknown as ReturnType<typeof useInstruments>)
  vi.mocked(useTransactions).mockReturnValue({
    data: [{}],
    isLoading: false,
  } as unknown as ReturnType<typeof useTransactions>)
  vi.mocked(usePortfolioTargets).mockReturnValue({
    data: [{}],
    isLoading: false,
  } as unknown as ReturnType<typeof usePortfolioTargets>)
  vi.mocked(usePortfolioBenchmarkSettings).mockReturnValue({
    data: { enabledKeys: ['VWRA'] },
    isLoading: false,
  } as unknown as ReturnType<typeof usePortfolioBenchmarkSettings>)
  vi.mocked(usePortfolioDataQuality).mockReturnValue({
    summary: { warningCount: 0 },
    isLoading: false,
    error: null,
    refetchAll: vi.fn(),
  } as unknown as ReturnType<typeof usePortfolioDataQuality>)
}
