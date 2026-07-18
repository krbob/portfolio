import { describe, expect, it } from 'vitest'
import type { MarketDataSnapshot } from '../api/read-model'
import { summarizeMarketDataProvenance } from './market-data-provenance'

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
      status: 'PARTIAL',
      limitedAnalytics: [],
      limitedAnalyticsCount: 0,
      refreshFailureCount: 1,
    })
  })

  it('returns null when the generated response contains no Stock provenance', () => {
    expect(summarizeMarketDataProvenance([snapshotWithoutProvenance()])).toBeNull()
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

  it('reports partial stock quote analytics without degrading current market-data health', () => {
    const quote = snapshot({ status: 'PARTIAL' })
    quote.identity = 'stock-quote:VWRA.L'

    const summary = summarizeMarketDataProvenance([
      quote,
      snapshot({ status: 'FRESH' }),
    ])

    expect(summary?.status).toBe('FRESH')
    expect(summary?.limitedAnalytics).toEqual([{ identity: 'VWRA.L', limitations: [] }])
    expect(summary?.limitedAnalyticsCount).toBe(1)
    expect(summary?.datasetCount).toBe(2)
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
    expect(summary?.limitedAnalytics).toEqual([
      { identity: 'VWRA.L', limitations: ['gain.fiveYear'] },
    ])
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
    expect(summary?.limitedAnalyticsCount).toBe(0)
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
    expect(summary?.limitedAnalyticsCount).toBe(1)
  })

  it.each(['stock-history:VWRA.L', 'reference:VWRA.L:PLN'])(
    'keeps a real partial analytical series visible for %s',
    (identity) => {
      const partialSeries = snapshot({ status: 'PARTIAL' })
      partialSeries.identity = identity

      const summary = summarizeMarketDataProvenance([partialSeries])

      expect(summary?.status).toBe('PARTIAL')
      expect(summary?.limitedAnalyticsCount).toBe(0)
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
    expect(summary?.limitedAnalyticsCount).toBe(0)
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
