import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarketDataSnapshotsSection } from './MarketDataSnapshotsSection'
import { useMarketDataSnapshots } from '../hooks/use-read-model'

vi.mock('../hooks/use-read-model', () => ({
  useMarketDataSnapshots: vi.fn(),
}))

vi.mock('../lib/i18n', async () => {
  const actual = await vi.importActual<typeof import('../lib/i18n')>('../lib/i18n')
  return {
    ...actual,
    getActiveUiLanguage: () => 'pl',
  }
})

describe('MarketDataSnapshotsSection', () => {
  it('renders cached snapshot coverage with localized labels', () => {
    vi.mocked(useMarketDataSnapshots).mockReturnValue({
      data: [
        {
          snapshotType: 'QUOTE',
          identity: 'PLN=X',
          cachedAt: '2026-03-27T12:05:00Z',
          sourceFrom: '2026-03-26',
          sourceTo: '2026-03-26',
          sourceAsOf: '2026-03-26',
          pointCount: 1,
        },
        {
          snapshotType: 'PRICE_SERIES',
          identity: 'VWRA.L',
          cachedAt: '2026-03-27T12:00:00Z',
          sourceFrom: '2026-03-01',
          sourceTo: '2026-03-03',
          sourceAsOf: '2026-03-03',
          pointCount: 3,
        },
        {
          snapshotType: 'QUOTE',
          identity: 'stock-quote:DTLA.L',
          cachedAt: '2026-03-27T12:06:00Z',
          sourceFrom: '2026-03-26',
          sourceTo: '2026-03-26',
          sourceAsOf: '2026-03-26',
          pointCount: 1,
          status: 'FRESH',
          lastCheckedAt: '2026-03-27T12:06:00Z',
          failureCount: 0,
          provenance: {
            source: 'YAHOO_FINANCE',
            retrievedAt: '2026-03-27T12:06:00Z',
            marketDate: '2026-03-26',
            currency: 'PLN',
            unitScale: 1,
            adjustment: 'SPLIT_ADJUSTED',
            coverageFrom: '2021-03-26',
            coverageTo: '2026-03-26',
            status: 'PARTIAL',
            priceStatus: 'FRESH',
            analyticsStatus: 'PARTIAL',
            analyticsLimitations: ['gain.fiveYear'],
          },
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useMarketDataSnapshots>)

    render(<MarketDataSnapshotsSection />)

    expect(screen.getByRole('heading', { name: 'Snapshoty fallbacku' })).toBeInTheDocument()
    expect(screen.getByText('PLN=X')).toBeInTheDocument()
    expect(screen.getByText('VWRA.L')).toBeInTheDocument()
    expect(screen.getByText('stock-quote:DTLA.L')).toBeInTheDocument()
    expect(screen.getAllByText('Kwotowanie')).toHaveLength(2)
    expect(screen.getByText('Seria cen')).toBeInTheDocument()
    expect(screen.getByText('2026-03-01 -> 2026-03-03')).toBeInTheDocument()
    expect(screen.queryByText('2026-03-26 -> 2026-03-26')).not.toBeInTheDocument()
    expect(screen.getAllByText('2026-03-26')).toHaveLength(4)
    expect(screen.getByText('Status ceny')).toBeInTheDocument()
    expect(screen.getByText('Status statystyk')).toBeInTheDocument()
    expect(screen.getByText('Niepełne')).toBeInTheDocument()
    expect(screen.getByText(/zwrot 5-letni/i)).toBeInTheDocument()
  })
})
