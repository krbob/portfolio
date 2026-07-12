import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarketDataStatusBarContent } from './MarketDataStatusBar'

describe('MarketDataStatusBar', () => {
  it('exposes all generated provenance dimensions in an accessible region', () => {
    render(
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
          status: 'FRESH',
          refreshFailureCount: 1,
        }}
        isRefreshing
      />,
    )

    const region = screen.getByRole('region', { name: /status danych rynkowych|market data status/i })
    expect(region).toHaveTextContent(/Yahoo Finance/)
    expect(region).toHaveTextContent(/PLN, USD/)
    expect(region).toHaveTextContent(/×1/)
    expect(region).toHaveTextContent(/korekta split|split adjusted/i)
    expect(region).toHaveTextContent(/świeże|fresh/i)
    expect(screen.getByRole('status')).toHaveTextContent(/odświeżanie|refreshing/i)
    expect(region.querySelectorAll('time')).toHaveLength(4)
  })

  it('uses a conservative warning tone for unknown generated status values', () => {
    render(
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
      />,
    )

    expect(screen.getByText(/nieznany|unknown/i)).toHaveClass('text-ui-text-muted')
  })
})
