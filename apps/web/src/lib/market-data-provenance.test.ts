import { describe, expect, it } from 'vitest'
import type { MarketDataSnapshot } from '../api/read-model'
import { marketPriceStatus, summarizeMarketDataProvenance } from './market-data-provenance'

describe('market data provenance', () => {
  it('summarizes generated snapshot provenance without using cache timestamps as market observations', () => {
    const summary = summarizeMarketDataProvenance([
      snapshot({
        marketTimestamp: '2026-03-20T20:00:00Z',
        marketDate: '2026-03-20',
        currency: 'USD',
        coverageFrom: '2026-03-01',
        coverageTo: '2026-03-20',
        status: 'FRESH',
      }),
      snapshot({
        source: 'YAHOO_FINANCE',
        retrievedAt: '2026-03-20T20:02:00Z',
        marketTimestamp: null,
        marketDate: '2026-03-19',
        currency: 'PLN',
        adjustment: 'RAW',
        coverageFrom: '2026-02-01',
        coverageTo: '2026-03-19',
        status: 'PARTIAL',
      }, 'FAILED'),
    ])

    expect(summary).toEqual({
      datasetCount: 2,
      sources: ['YAHOO_FINANCE'],
      observedAt: '2026-03-20T20:00:00Z',
      retrievedAt: '2026-03-20T20:02:00Z',
      coverageFrom: '2026-02-01',
      coverageTo: '2026-03-20',
      currencies: ['PLN', 'USD'],
      unitScales: [1],
      adjustments: ['RAW', 'SPLIT_ADJUSTED'],
      status: 'STALE',
      refreshFailureCount: 1,
    })
  })

  it('returns null when the generated response contains only non-Stock datasets', () => {
    expect(summarizeMarketDataProvenance([{
      ...snapshotWithoutProvenance(), identity: 'edo-history:2025-11-07|575|200',
    }])).toBeNull()
  })

  it('shows stale fallback after seven failed refreshes despite fresh saved price provenance', () => {
    const failed = Array.from({ length: 7 }, (_, index) => ({
      ...snapshot({ status: 'PARTIAL', priceStatus: 'FRESH', analyticsStatus: 'PARTIAL' }, 'FAILED'),
      identity: `stock-quote:SYMBOL${index}`,
      failureCount: 1,
    }))

    expect(summarizeMarketDataProvenance(failed)).toMatchObject({
      status: 'STALE', refreshFailureCount: 7, datasetCount: 7,
    })
    expect(marketPriceStatus(failed[0])).toBe('STALE')

    const recovered = failed.map((item) => ({ ...item, status: 'FRESH', failureCount: 0 }))
    expect(summarizeMarketDataProvenance(recovered)).toMatchObject({ status: 'FRESH', refreshFailureCount: 0 })
  })

  it.each(['STALE', 'DELAYED'])('honors local %s status even when saved provenance is fresh', (status) => {
    expect(summarizeMarketDataProvenance([snapshot({ status: 'FRESH' }, status)])?.status).toBe('STALE')
  })

  it('reports a first fetch failure even before Stock provenance exists', () => {
    const failed = { ...snapshotWithoutProvenance(), status: 'FAILED', failureCount: 1 }
    expect(summarizeMarketDataProvenance([failed])).toMatchObject({
      status: 'ERROR', refreshFailureCount: 1, datasetCount: 1, sources: [],
    })
  })

  it('keeps a stale valuation visible until the overview itself recovers', () => {
    const recoveredSnapshots = [snapshot({ status: 'FRESH' })]
    expect(summarizeMarketDataProvenance(recoveredSnapshots, 'STALE')?.status).toBe('STALE')
    expect(summarizeMarketDataProvenance(recoveredSnapshots, 'PARTIALLY_VALUED')?.status).toBe('PARTIAL')
    expect(summarizeMarketDataProvenance(recoveredSnapshots, 'MARK_TO_MARKET')?.status).toBe('FRESH')
  })

  it('treats unknown upstream statuses conservatively', () => {
    const summary = summarizeMarketDataProvenance([snapshot({ status: 'NEW_STATUS' })])
    expect(summary?.status).toBe('UNKNOWN')
  })

  it('does not let a bounded historical FX lookup degrade the live status', () => {
    const historicalFx = snapshot({
      marketTimestamp: null,
      marketDate: '2026-05-07',
      coverageFrom: '2026-02-11',
      coverageTo: '2026-05-07',
      status: 'STALE',
    })
    historicalFx.identity = 'fx-history:USD'

    const summary = summarizeMarketDataProvenance([
      historicalFx,
      snapshot({
        marketDate: '2026-07-16',
        coverageFrom: '2026-07-01',
        coverageTo: '2026-07-16',
        status: 'FRESH',
      }),
    ])

    expect(summary?.datasetCount).toBe(1)
    expect(summary?.status).toBe('FRESH')
    expect(summary?.coverageFrom).toBe('2026-07-01')
  })

  it('keeps optional stock quote analytics out of the global market-data summary', () => {
    const quote = snapshot({ status: 'PARTIAL' })
    quote.identity = 'stock-quote:VWRA.L'

    const summary = summarizeMarketDataProvenance([
      quote,
      snapshot({ status: 'FRESH' }),
    ])

    expect(summary?.status).toBe('FRESH')
    expect(summary?.datasetCount).toBe(2)
    expect(summary).not.toHaveProperty('limitedAnalytics')
    expect(summary).not.toHaveProperty('limitedAnalyticsCount')
  })

  it('uses explicit price and analytics statuses when the additive quote quality contract is present', () => {
    const quote = snapshot({
      status: 'PARTIAL',
      priceStatus: 'FRESH',
      analyticsStatus: 'PARTIAL',
      analyticsLimitations: ['gain.fiveYear'],
    })
    quote.identity = 'stock-quote:VWRA.L'

    const summary = summarizeMarketDataProvenance([quote])

    expect(summary?.status).toBe('FRESH')
    expect(summary).not.toHaveProperty('limitedAnalytics')
  })

  it('does not carry a legacy partial status into analytics when the explicit status is complete', () => {
    const quote = snapshot({
      status: 'PARTIAL',
      priceStatus: 'FRESH',
      analyticsStatus: 'COMPLETE',
      analyticsLimitations: [],
    })
    quote.identity = 'stock-quote:VWRA.L'

    const summary = summarizeMarketDataProvenance([quote])

    expect(summary?.status).toBe('FRESH')
  })

  it('never hides an explicit stale price behind an analytics-only status', () => {
    const quote = snapshot({
      status: 'PARTIAL',
      priceStatus: 'STALE',
      analyticsStatus: 'PARTIAL',
      analyticsLimitations: ['gain.fiveYear'],
    })
    quote.identity = 'stock-quote:VWRA.L'

    const summary = summarizeMarketDataProvenance([quote])

    expect(summary?.status).toBe('STALE')
  })

  it.each(['stock-history:VWRA.L', 'reference:VWRA.L:PLN'])(
    'keeps a real partial analytical series visible for %s',
    (identity) => {
      const partialSeries = snapshot({ status: 'PARTIAL' })
      partialSeries.identity = identity

      const summary = summarizeMarketDataProvenance([partialSeries])

      expect(summary?.status).toBe('PARTIAL')
    },
  )

  it.each([
    ['STALE', 'STALE'],
    ['ERROR', 'ERROR'],
  ])('does not suppress a real %s quote provenance status', (provenanceStatus, expectedStatus) => {
    const quote = snapshot({ status: provenanceStatus })
    quote.identity = 'stock-quote:VWRA.L'

    const summary = summarizeMarketDataProvenance([quote])

    expect(summary?.status).toBe(expectedStatus)
  })
})

function snapshot(
  overrides: Partial<NonNullable<MarketDataSnapshot['provenance']>> = {},
  status = 'FRESH',
): MarketDataSnapshot {
  return {
    ...snapshotWithoutProvenance(),
    status,
    provenance: {
      source: 'YAHOO_FINANCE',
      retrievedAt: '2026-03-20T20:01:00Z',
      marketTimestamp: '2026-03-20T20:00:00Z',
      marketDate: '2026-03-20',
      currency: 'USD',
      unitScale: 1,
      adjustment: 'SPLIT_ADJUSTED',
      coverageFrom: '2026-03-01',
      coverageTo: '2026-03-20',
      status: 'FRESH',
      ...overrides,
    },
  }
}

function snapshotWithoutProvenance(): MarketDataSnapshot {
  return {
    snapshotType: 'PRICE_SERIES',
    identity: 'stock-history:VWRA.L',
    cachedAt: '2026-03-20T20:03:00Z',
    status: 'FRESH',
    lastCheckedAt: '2026-03-20T20:03:00Z',
    failureCount: 0,
  }
}
