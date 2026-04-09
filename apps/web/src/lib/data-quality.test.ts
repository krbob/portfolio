import { describe, expect, it } from 'vitest'
import type { PortfolioDailyHistory, PortfolioOverview, PortfolioReturns, ReadModelCacheSnapshot } from '../api/read-model'
import type { ReadModelRefreshStatus } from '../api/write-model'
import { buildPortfolioDataQualitySummary } from './data-quality'

describe('buildPortfolioDataQualitySummary', () => {
  it('derives benchmark and CPI coverage while surfacing degraded gold availability', () => {
    const summary = buildPortfolioDataQualitySummary({
      overview: overview(),
      history: history(),
      returns: returns(),
      cacheSnapshots: cacheSnapshots(),
      refreshStatus: refreshStatus(),
      isPolish: false,
      now: new Date('2026-03-20T12:00:00Z'),
    })

    expect(summary).not.toBeNull()
    expect(summary?.overallStatus).toBe('WARN')
    expect(summary?.benchmarkCoverageLabel).toBe('1 / 2')
    expect(summary?.cpiCoverageThroughMonth).toBe('2026-02')
    expect(summary?.goldSeriesAvailable).toBe(false)
    expect(summary?.warningCount).toBe(2)
    expect(summary?.noticeMessages.some((message) => message.includes('gold reference view'))).toBe(true)
  })

  it('marks data quality as degraded when the latest refresh failed after the last success', () => {
    const summary = buildPortfolioDataQualitySummary({
      overview: overview(),
      history: history(),
      returns: returns(),
      cacheSnapshots: cacheSnapshots(),
      refreshStatus: {
        ...refreshStatus(),
        lastRunAt: '2026-03-20T13:05:00Z',
        lastSuccessAt: '2026-03-20T12:02:00Z',
        lastFailureAt: '2026-03-20T13:05:00Z',
        lastFailureMessage: 'benchmark refresh timed out',
      },
      isPolish: false,
      now: new Date('2026-03-20T13:05:00Z'),
    })

    expect(summary).not.toBeNull()
    expect(summary?.overallStatus).toBe('WARN')
    expect(summary?.lastRefreshAt).toBe('2026-03-20T13:05:00Z')

    const refreshCheck = summary?.checks.find((check) => check.key === 'refresh')
    expect(refreshCheck?.status).toBe('WARN')
    expect(refreshCheck?.message).toContain('benchmark refresh timed out')
    expect(refreshCheck?.message).not.toContain('2026-03-20T13:05:00Z')
  })

  it('formats the last successful refresh timestamp for display', () => {
    const summary = buildPortfolioDataQualitySummary({
      overview: overview(),
      history: history(),
      returns: returns(),
      cacheSnapshots: cacheSnapshots(),
      refreshStatus: refreshStatus(),
      isPolish: false,
      now: new Date('2026-03-20T12:00:00Z'),
    })

    const refreshCheck = summary?.checks.find((check) => check.key === 'refresh')
    expect(refreshCheck?.status).toBe('PASS')
    expect(refreshCheck?.message).toContain('Last successful refresh:')
    expect(refreshCheck?.message).toContain('2026')
    expect(refreshCheck?.message).not.toContain('2026-03-20T12:02:00Z')
  })

  it('does not warn on benchmarks when all configured benchmarks are still available', () => {
    const summary = buildPortfolioDataQualitySummary({
      overview: overview(),
      history: history({ benchmarkSeriesIssueCount: 1 }),
      returns: returns({
        benchmarks: [
          benchmark('VWRA', true),
          benchmark('CUSTOM_1', true),
        ],
      }),
      cacheSnapshots: cacheSnapshots(),
      refreshStatus: refreshStatus(),
      isPolish: false,
      now: new Date('2026-03-20T12:00:00Z'),
    })

    const benchmarkCheck = summary?.checks.find((check) => check.key === 'benchmarks')
    expect(benchmarkCheck?.status).toBe('PASS')
    expect(benchmarkCheck?.message).toContain('Available benchmarks: 2 of 2.')
  })

  it('warns when CPI coverage is stale beyond the tolerated publication lag', () => {
    const summary = buildPortfolioDataQualitySummary({
      overview: overview(),
      history: history(),
      returns: returns({ inflationUntil: '2026-01' }),
      cacheSnapshots: cacheSnapshots(),
      refreshStatus: refreshStatus(),
      isPolish: false,
      now: new Date('2026-03-27T12:00:00Z'),
    })

    const cpiCheck = summary?.checks.find((check) => check.key === 'cpi')
    expect(cpiCheck?.status).toBe('WARN')
    expect(cpiCheck?.message).toContain('through December 2025')
    expect(cpiCheck?.message).toContain('at least January 2026')
  })
})

function overview(): PortfolioOverview {
  return {
    asOf: '2026-03-20',
    valuationState: 'MARK_TO_MARKET',
    totalBookValuePln: '1000.00',
    totalCurrentValuePln: '1050.00',
    investedBookValuePln: '900.00',
    investedCurrentValuePln: '950.00',
    cashBalancePln: '100.00',
    netContributionsPln: '1000.00',
    equityBookValuePln: '900.00',
    equityCurrentValuePln: '950.00',
    bondBookValuePln: '0.00',
    bondCurrentValuePln: '0.00',
    cashBookValuePln: '100.00',
    cashCurrentValuePln: '100.00',
    totalUnrealizedGainPln: '50.00',
    accountCount: 1,
    instrumentCount: 1,
    activeHoldingCount: 1,
    valuedHoldingCount: 1,
    unvaluedHoldingCount: 0,
    valuationIssueCount: 0,
    missingFxTransactions: 0,
    unsupportedCorrectionTransactions: 0,
  }
}

function history(overrides: Partial<PortfolioDailyHistory> = {}): PortfolioDailyHistory {
  return {
    from: '2026-01-01',
    until: '2026-03-20',
    valuationState: 'MARK_TO_MARKET',
    instrumentHistoryIssueCount: 0,
    referenceSeriesIssueCount: 0,
    benchmarkSeriesIssueCount: 1,
    missingFxTransactions: 0,
    unsupportedCorrectionTransactions: 0,
    points: [
      {
        date: '2026-03-20',
        totalBookValuePln: '1000.00',
        totalCurrentValuePln: '1050.00',
        netContributionsPln: '1000.00',
        cashBalancePln: '100.00',
        totalCurrentValueUsd: '250.00',
        netContributionsUsd: '240.00',
        cashBalanceUsd: '25.00',
        totalCurrentValueAu: null,
        netContributionsAu: null,
        cashBalanceAu: null,
        equityCurrentValuePln: '950.00',
        bondCurrentValuePln: '0.00',
        cashCurrentValuePln: '100.00',
        equityAllocationPct: '90.48',
        bondAllocationPct: '0.00',
        cashAllocationPct: '9.52',
        portfolioPerformanceIndex: '1.05',
        benchmarkIndices: { VWRA: '1.03', INFLATION: '1.01', TARGET_MIX: '1.02' },
        activeHoldingCount: 1,
        valuedHoldingCount: 1,
      },
    ],
    ...overrides,
  }
}

function returns(overrides: { inflationUntil?: string; benchmarks?: PortfolioReturns['periods'][number]['benchmarks'] } = {}): PortfolioReturns {
  return {
    asOf: '2026-03-20',
    periods: [
      {
        key: 'MAX',
        label: 'MAX',
        requestedFrom: '2026-01-01',
        from: '2026-01-01',
        until: '2026-03-20',
        clippedToInception: false,
        dayCount: 79,
        nominalPln: {
          moneyWeightedReturn: '0.05',
          annualizedMoneyWeightedReturn: '0.05',
          timeWeightedReturn: '0.05',
          annualizedTimeWeightedReturn: '0.05',
        },
        nominalUsd: null,
        realPln: {
          moneyWeightedReturn: '0.03',
          annualizedMoneyWeightedReturn: '0.03',
          timeWeightedReturn: '0.03',
          annualizedTimeWeightedReturn: '0.03',
        },
        inflationFrom: '2026-01',
        inflationUntil: overrides.inflationUntil ?? '2026-03',
        inflationMultiplier: '1.02',
        benchmarks: overrides.benchmarks ?? [
          benchmark('VWRA', true),
          benchmark('CUSTOM_1', false),
        ],
      },
    ],
  }
}

function benchmark(key: string, available: boolean): PortfolioReturns['periods'][number]['benchmarks'][number] {
  return {
    key,
    label: `${key} benchmark`,
    pinned: key === 'VWRA',
    status: available ? 'HEALTHY' : 'UNAVAILABLE',
    issue: available ? null : `${key} benchmark is unavailable.`,
    nominalPln: available
      ? {
          moneyWeightedReturn: '0.04',
          annualizedMoneyWeightedReturn: '0.04',
          timeWeightedReturn: '0.04',
          annualizedTimeWeightedReturn: '0.04',
        }
      : null,
    excessTimeWeightedReturn: available ? '0.01' : null,
    excessAnnualizedTimeWeightedReturn: available ? '0.01' : null,
  }
}

function cacheSnapshots(): ReadModelCacheSnapshot[] {
  return [
    {
      cacheKey: 'portfolio.daily-history',
      modelName: 'DAILY_HISTORY',
      modelVersion: 1,
      inputsFrom: '2026-01-01',
      inputsTo: '2026-03-20',
      sourceUpdatedAt: '2026-03-20T11:00:00Z',
      generatedAt: '2026-03-20T12:00:00Z',
      invalidationReason: 'EXPLICIT_REFRESH',
      payloadSizeBytes: 2048,
    },
    {
      cacheKey: 'portfolio.returns',
      modelName: 'RETURNS',
      modelVersion: 1,
      inputsFrom: '2026-01-01',
      inputsTo: '2026-03-20',
      sourceUpdatedAt: '2026-03-20T11:00:00Z',
      generatedAt: '2026-03-20T12:02:00Z',
      invalidationReason: 'EXPLICIT_REFRESH',
      payloadSizeBytes: 1024,
    },
  ]
}

function refreshStatus(): ReadModelRefreshStatus {
  return {
    schedulerEnabled: true,
    intervalMinutes: 720,
    runOnStart: true,
    running: false,
    lastRunAt: '2026-03-20T12:02:00Z',
    lastSuccessAt: '2026-03-20T12:02:00Z',
    lastFailureAt: null,
    lastFailureMessage: null,
    lastTrigger: 'SCHEDULED',
    lastDurationMs: 420,
    modelNames: ['DAILY_HISTORY', 'RETURNS'],
  }
}
