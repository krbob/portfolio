import { describe, expect, it } from 'vitest'
import type { PortfolioOverview, MarketDataSnapshot } from '../api/read-model'
import type { AppReadiness } from '../api/system'
import { buildStaleMarketDataAlert } from './stale-market-data-alert'

describe('buildStaleMarketDataAlert', () => {
  it('returns null when the overview is not stale', () => {
    const alert = buildStaleMarketDataAlert({
      overview: overview({ valuationState: 'MARK_TO_MARKET' }),
      snapshots: [],
      readiness: undefined,
      language: 'en',
    })

    expect(alert).toBeNull()
  })

  it('builds an actionable stale alert with snapshot and upstream context', () => {
    const alert = buildStaleMarketDataAlert({
      overview: overview({ valuationState: 'STALE', valuationIssueCount: 2 }),
      snapshots: [
        snapshot('2026-03-26T10:00:00Z'),
        snapshot('2026-03-27T08:30:00Z'),
      ],
      readiness: readiness('stock-analyst'),
      language: 'pl',
    })

    expect(alert).not.toBeNull()
    expect(alert?.latestSnapshotAt).toBe('2026-03-27T08:30:00Z')
    expect(alert?.upstreamLabel).toBe('Stock Analyst')
    expect(alert?.valuationCoverageLabel).toBe('4 / 5')
    expect(alert?.message).toContain('27')
    expect(alert?.message).toContain('Otwarte luki wyceny: 2.')
  })

  it('builds the same alert copy in english when requested', () => {
    const alert = buildStaleMarketDataAlert({
      overview: overview({ valuationState: 'STALE', valuationIssueCount: 2 }),
      snapshots: [snapshot('2026-03-27T08:30:00Z')],
      readiness: readiness('stock-analyst'),
      language: 'en',
    })

    expect(alert?.title).toBe('Valuation is running on stale market data')
    expect(alert?.message).toContain('Open valuation gaps: 2.')
  })
})

function overview(overrides: Partial<PortfolioOverview>): PortfolioOverview {
  return {
    asOf: '2026-03-27',
    valuationState: 'STALE',
    activeHoldingCount: 5,
    valuedHoldingCount: 4,
    unvaluedHoldingCount: 1,
    valuationIssueCount: 0,
    missingFxTransactions: 0,
    totalBookValuePln: '100.00',
    totalCurrentValuePln: '100.00',
    totalCurrentValueUsd: '25.00',
    totalCurrentValueAu: '0.01',
    totalUnrealizedGainPln: '5.00',
    netContributionsPln: '95.00',
    cashBalancePln: '0.00',
    equityCurrentValuePln: '80.00',
    bondCurrentValuePln: '20.00',
    cashCurrentValuePln: '0.00',
    equityBookValuePln: '78.00',
    bondBookValuePln: '17.00',
    cashBookValuePln: '0.00',
    cashBalances: [],
    netContributionBalances: [],
    ...overrides,
  } as PortfolioOverview
}

function snapshot(cachedAt: string): MarketDataSnapshot {
  return {
    snapshotType: 'QUOTE',
    identity: 'VWRA.L',
    cachedAt,
    sourceFrom: null,
    sourceTo: null,
    sourceAsOf: '2026-03-27',
    pointCount: 1,
  }
}

function readiness(key: string): AppReadiness {
  return {
    status: 'DEGRADED',
    checkedAt: '2026-03-27T09:00:00Z',
    checks: [
      {
        key,
        label: 'Stock Analyst',
        status: 'WARN',
        message: 'Upstream failed.',
        details: {},
      },
    ],
  }
}
