import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MARKET_DATA_SNAPSHOTS_QUERY_KEY, PORTFOLIO_OVERVIEW_QUERY_KEY } from '../hooks/use-read-model'
import { MarketDataStatusBar, MarketDataStatusBarContent } from './MarketDataStatusBar'

describe('MarketDataStatusBar', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('keeps the headline stale through snapshot recovery until the loaded valuation recovers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    const quote = {
      snapshotType: 'QUOTE', identity: 'stock-quote:VGLA.DE', status: 'FAILED', failureCount: 1,
      provenance: { status: 'PARTIAL', priceStatus: 'FRESH', analyticsStatus: 'PARTIAL' },
    }
    client.setQueryData(MARKET_DATA_SNAPSHOTS_QUERY_KEY, [quote])
    const view = render(<QueryClientProvider client={client}><MarketDataStatusBar /></QueryClientProvider>)
    const region = screen.getByRole('region', { name: /status danych rynkowych|market data status/i })

    expect(region).toHaveTextContent(/nieaktualne|stale/i)
    expect(region).toHaveTextContent(/zestawy z błędem odświeżania: 1|datasets with refresh errors: 1/i)
    await act(async () => {
      client.setQueryData(PORTFOLIO_OVERVIEW_QUERY_KEY, { valuationState: 'STALE' })
      client.setQueryData(MARKET_DATA_SNAPSHOTS_QUERY_KEY, [{ ...quote, status: 'FRESH', failureCount: 0 }])
    })
    await waitFor(() => {
      expect(region).toHaveTextContent(/nieaktualne|stale/i)
      expect(region).not.toHaveTextContent(/zestawy z błędem|datasets with refresh errors/i)
    })

    await act(async () => client.setQueryData(PORTFOLIO_OVERVIEW_QUERY_KEY, { valuationState: 'MARK_TO_MARKET' }))
    await waitFor(() => expect(region).toHaveTextContent(/świeże|fresh/i))
    expect(region).not.toHaveTextContent(/nieaktualne|stale/i)
    expect(fetchSpy).not.toHaveBeenCalled()
    view.unmount()
    client.clear()
  })

  it('exposes all generated provenance dimensions in an accessible region', () => {
    render(<MemoryRouter>
      <MarketDataStatusBarContent
        summary={{
          datasetCount: 2,
          sources: ['YAHOO_FINANCE'],
          observedAt: '2026-03-20T20:00:00Z',
          retrievedAt: '2026-03-20T20:02:00Z',
          coverageFrom: '2026-03-01',
          coverageTo: '2026-03-20',
          currencies: ['PLN', 'USD'],
          unitScales: [1],
          adjustments: ['SPLIT_ADJUSTED'],
          status: 'STALE',
          refreshFailureCount: 1,
        }}
        isRefreshing
      />
    </MemoryRouter>)

    const region = screen.getByRole('region', { name: /status danych rynkowych|market data status/i })
    expect(region).toHaveTextContent(/Yahoo Finance/)
    expect(region).toHaveTextContent(/PLN, USD/)
    expect(region).toHaveTextContent(/×1/)
    expect(region).toHaveTextContent(/korekta split|split adjusted/i)
    expect(region).toHaveTextContent(/nieaktualne|stale/i)
    expect(region).toHaveTextContent(/zestawy z błędem odświeżania: 1|datasets with refresh errors: 1/i)
    expect(region).not.toHaveTextContent(/statystyki: niepełne|analytics: incomplete/i)
    expect(screen.getByRole('status')).toHaveTextContent(/odświeżanie|refreshing/i)
    expect(region.querySelectorAll('time')).toHaveLength(4)
  })

  it('uses a conservative warning tone for unknown generated status values', () => {
    render(<MemoryRouter>
      <MarketDataStatusBarContent
        summary={{
          datasetCount: 1,
          sources: ['NEW_SOURCE'],
          observedAt: null,
          retrievedAt: null,
          coverageFrom: null,
          coverageTo: null,
          currencies: [],
          unitScales: [],
          adjustments: [],
          status: 'UNKNOWN',
          refreshFailureCount: 0,
        }}
      />
    </MemoryRouter>)

    expect(screen.getByText(/nieznany|unknown/i)).toHaveClass('text-ui-text-muted')
  })
})
