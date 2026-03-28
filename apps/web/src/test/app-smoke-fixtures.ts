import { QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'

export function createStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

export function createAppFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

    if (url.includes('/api/v1/auth/session')) {
      return jsonResponse({
        authEnabled: false,
        authenticated: true,
        mode: 'DISABLED',
      })
    }

    if (url.includes('/api/v1/meta')) {
      return jsonResponse({
        name: 'Portfolio',
        stage: 'dev',
        version: '0.1.0-test',
        auth: {
          enabled: false,
          mode: 'DISABLED',
        },
        stack: {
          web: 'React 19 + TypeScript + Vite',
          api: 'Kotlin 2.3 + Ktor 3',
          database: 'SQLite',
        },
        capabilities: ['Transaction-based portfolio accounting'],
      })
    }

    if (url.includes('/api/v1/readiness')) {
      return jsonResponse({
        status: 'READY',
        checkedAt: '2026-03-27T12:00:00Z',
        checks: [
          {
            key: 'sqlite-directory',
            label: 'SQLite directory',
            status: 'PASS',
            message: 'Using portfolio.db in /srv/portfolio/data.',
          },
          {
            key: 'stock-analyst',
            label: 'Stock analyst',
            status: 'PASS',
            message: 'Upstream is reachable.',
          },
          {
            key: 'edo-calculator',
            label: 'EDO calculator',
            status: 'PASS',
            message: 'Upstream is reachable.',
          },
        ],
      })
    }

    if (url.includes('/api/v1/portfolio/overview')) {
      return jsonResponse({
        asOf: '2026-03-27',
        valuationState: 'MARK_TO_MARKET',
        totalBookValuePln: '10000.00',
        totalCurrentValuePln: '10550.00',
        investedBookValuePln: '7600.00',
        investedCurrentValuePln: '8150.00',
        cashBalancePln: '2400.00',
        cashBalances: [{ currency: 'PLN', amount: '2400.00', bookValuePln: '2400.00' }],
        netContributionsPln: '10000.00',
        netContributionBalances: [{ currency: 'PLN', amount: '10000.00', bookValuePln: '10000.00' }],
        equityBookValuePln: '4600.00',
        equityCurrentValuePln: '5000.00',
        bondBookValuePln: '3000.00',
        bondCurrentValuePln: '3150.00',
        cashBookValuePln: '2400.00',
        cashCurrentValuePln: '2400.00',
        totalUnrealizedGainPln: '550.00',
        accountCount: 2,
        instrumentCount: 3,
        activeHoldingCount: 3,
        valuedHoldingCount: 3,
        unvaluedHoldingCount: 0,
        valuationIssueCount: 0,
        missingFxTransactions: 0,
        unsupportedCorrectionTransactions: 0,
      })
    }

    if (url.includes('/api/v1/portfolio/holdings')) {
      return jsonResponse([
        {
          accountId: 'acc-broker',
          accountName: 'Broker',
          instrumentId: 'ins-vwra',
          instrumentName: 'VWRA',
          kind: 'ETF',
          assetClass: 'EQUITIES',
          currency: 'USD',
          quantity: '10',
          averageCostPerUnitPln: '400.00',
          costBasisPln: '4000.00',
          bookValuePln: '4000.00',
          currentPricePln: '430.00',
          currentValuePln: '4300.00',
          unrealizedGainPln: '300.00',
          valuedAt: '2026-03-27',
          valuationStatus: 'VALUED',
          valuationIssue: null,
          transactionCount: 2,
        },
        {
          accountId: 'acc-bonds',
          accountName: 'Rejestr obligacji',
          instrumentId: 'ins-edo',
          instrumentName: 'EDO0135',
          kind: 'BOND_EDO',
          assetClass: 'BONDS',
          currency: 'PLN',
          quantity: '35',
          averageCostPerUnitPln: '100.00',
          costBasisPln: '3500.00',
          bookValuePln: '3500.00',
          currentPricePln: '104.29',
          currentValuePln: '3650.15',
          unrealizedGainPln: '150.15',
          valuedAt: '2026-03-27',
          valuationStatus: 'VALUED',
          valuationIssue: null,
          transactionCount: 1,
          edoLots: [
            {
              purchaseDate: '2025-01-15',
              quantity: '35',
              costBasisPln: '3500.00',
              currentPricePln: '104.29',
              currentValuePln: '3650.15',
              unrealizedGainPln: '150.15',
              valuedAt: '2026-03-27',
              valuationStatus: 'VALUED',
              valuationIssue: null,
            },
          ],
        },
      ])
    }

    if (url.includes('/api/v1/portfolio/accounts')) {
      return jsonResponse([
        {
          accountId: 'acc-broker',
          accountName: 'Broker',
          institution: 'Interactive Brokers',
          type: 'BROKERAGE',
          baseCurrency: 'PLN',
          valuationState: 'MARK_TO_MARKET',
          totalBookValuePln: '6400.00',
          totalCurrentValuePln: '6700.00',
          investedBookValuePln: '4000.00',
          investedCurrentValuePln: '4300.00',
          cashBalancePln: '2400.00',
          cashBalances: [{ currency: 'PLN', amount: '2400.00', bookValuePln: '2400.00' }],
          netContributionsPln: '6400.00',
          netContributionBalances: [{ currency: 'PLN', amount: '6400.00', bookValuePln: '6400.00' }],
          totalUnrealizedGainPln: '300.00',
          portfolioWeightPct: '63.51',
          activeHoldingCount: 1,
          valuedHoldingCount: 1,
          valuationIssueCount: 0,
        },
        {
          accountId: 'acc-bonds',
          accountName: 'Rejestr obligacji',
          institution: 'Obligacje Skarbowe',
          type: 'BOND_REGISTER',
          baseCurrency: 'PLN',
          valuationState: 'MARK_TO_MARKET',
          totalBookValuePln: '3650.00',
          totalCurrentValuePln: '3850.15',
          investedBookValuePln: '3500.00',
          investedCurrentValuePln: '3650.15',
          cashBalancePln: '200.00',
          cashBalances: [{ currency: 'PLN', amount: '200.00', bookValuePln: '200.00' }],
          netContributionsPln: '3600.00',
          netContributionBalances: [{ currency: 'PLN', amount: '3600.00', bookValuePln: '3600.00' }],
          totalUnrealizedGainPln: '200.15',
          portfolioWeightPct: '36.49',
          activeHoldingCount: 1,
          valuedHoldingCount: 1,
          valuationIssueCount: 0,
        },
      ])
    }

    if (url.includes('/api/v1/portfolio/history/daily')) {
      return jsonResponse({
        from: '2026-03-20',
        until: '2026-03-27',
        valuationState: 'MARK_TO_MARKET',
        instrumentHistoryIssueCount: 0,
        referenceSeriesIssueCount: 0,
        benchmarkSeriesIssueCount: 0,
        missingFxTransactions: 0,
        unsupportedCorrectionTransactions: 0,
        points: [
          {
            date: '2026-03-20',
            totalBookValuePln: '10000.00',
            totalCurrentValuePln: '10100.00',
            netContributionsPln: '10000.00',
            cashBalancePln: '2500.00',
            totalCurrentValueUsd: '2530.00',
            netContributionsUsd: '2500.00',
            cashBalanceUsd: '625.00',
            totalCurrentValueAu: '0.845000',
            netContributionsAu: '0.833333',
            cashBalanceAu: '0.208333',
            equityCurrentValuePln: '4600.00',
            bondCurrentValuePln: '3000.00',
            cashCurrentValuePln: '2500.00',
            equityAllocationPct: '45.54',
            bondAllocationPct: '29.70',
            cashAllocationPct: '24.75',
            portfolioPerformanceIndex: '100.00',
            benchmarkIndices: { VWRA: '100.00', CUSTOM: '99.80', TARGET_MIX: '100.10' },
            activeHoldingCount: 2,
            valuedHoldingCount: 2,
          },
          {
            date: '2026-03-27',
            totalBookValuePln: '10000.00',
            totalCurrentValuePln: '10550.00',
            netContributionsPln: '10000.00',
            cashBalancePln: '2400.00',
            totalCurrentValueUsd: '2640.00',
            netContributionsUsd: '2500.00',
            cashBalanceUsd: '600.00',
            totalCurrentValueAu: '0.872000',
            netContributionsAu: '0.833333',
            cashBalanceAu: '0.198347',
            equityCurrentValuePln: '5000.00',
            bondCurrentValuePln: '3150.00',
            cashCurrentValuePln: '2400.00',
            equityAllocationPct: '47.39',
            bondAllocationPct: '29.86',
            cashAllocationPct: '22.75',
            portfolioPerformanceIndex: '104.95',
            benchmarkIndices: { VWRA: '103.20', CUSTOM: '102.60', TARGET_MIX: '103.00' },
            activeHoldingCount: 2,
            valuedHoldingCount: 2,
          },
        ],
      })
    }

    if (url.includes('/api/v1/portfolio/returns')) {
      return jsonResponse({
        asOf: '2026-03-27',
        periods: [
          {
            key: 'MAX',
            label: 'Since inception',
            nominalPln: { moneyWeightedReturn: '5.50', timeWeightedReturn: '5.00', annualizedReturn: '5.00' },
            realPln: { moneyWeightedReturn: '3.40', timeWeightedReturn: '3.00', annualizedReturn: '3.00' },
            contributionBridge: {
              netInvestmentPln: '10000.00',
              marketEffectPln: '550.00',
              incomeAndFeesPln: '0.00',
            },
            benchmarks: [
              {
                key: 'VWRA',
                label: 'VWRA benchmark',
                nominalPln: { moneyWeightedReturn: '3.20', timeWeightedReturn: '3.20', annualizedReturn: '3.20' },
                realPln: { moneyWeightedReturn: '1.20', timeWeightedReturn: '1.20', annualizedReturn: '1.20' },
                relativeNominalPln: '2.30',
                relativeRealPln: '2.20',
              },
              {
                key: 'CUSTOM',
                label: 'Custom benchmark',
                nominalPln: { moneyWeightedReturn: '2.60', timeWeightedReturn: '2.60', annualizedReturn: '2.60' },
                realPln: { moneyWeightedReturn: '0.60', timeWeightedReturn: '0.60', annualizedReturn: '0.60' },
                relativeNominalPln: '2.90',
                relativeRealPln: '2.80',
              },
            ],
          },
        ],
      })
    }

    if (url.includes('/api/v1/portfolio/allocation')) {
      return jsonResponse({
        valuationState: 'MARK_TO_MARKET',
        totalCurrentValuePln: '10550.00',
        buckets: [
          {
            assetClass: 'EQUITIES',
            currentValuePln: '5000.00',
            currentWeightPct: '47.39',
            targetWeightPct: '60.00',
            driftPctPoints: '-12.61',
            gapValuePln: '1330.00',
            rebalanceAction: 'BUY',
          },
          {
            assetClass: 'BONDS',
            currentValuePln: '3150.00',
            currentWeightPct: '29.86',
            targetWeightPct: '25.00',
            driftPctPoints: '4.86',
            gapValuePln: '0.00',
            rebalanceAction: 'HOLD',
          },
          {
            assetClass: 'CASH',
            currentValuePln: '2400.00',
            currentWeightPct: '22.75',
            targetWeightPct: '15.00',
            driftPctPoints: '7.75',
            gapValuePln: '0.00',
            rebalanceAction: 'HOLD',
          },
        ],
      })
    }

    if (url.includes('/api/v1/portfolio/read-model-cache')) {
      return jsonResponse([
        {
          cacheKey: 'portfolio.daily-history',
          label: 'Daily history',
          generatedAt: '2026-03-27T10:00:00Z',
          sourceUpdatedAt: '2026-03-27T09:59:00Z',
          status: 'FRESH',
        },
        {
          cacheKey: 'portfolio.returns',
          label: 'Returns',
          generatedAt: '2026-03-27T10:00:10Z',
          sourceUpdatedAt: '2026-03-27T09:59:00Z',
          status: 'FRESH',
        },
      ])
    }

    if (url.includes('/api/v1/portfolio/read-model-refresh')) {
      return jsonResponse({
        schedulerEnabled: true,
        intervalMinutes: 720,
        lastRunAt: '2026-03-27T10:00:10Z',
        lastSuccessAt: '2026-03-27T10:00:10Z',
        lastFailureAt: null,
      })
    }

    if (url.includes('/api/v1/accounts')) {
      return jsonResponse([
        {
          id: 'acc-broker',
          name: 'Broker',
          institution: 'Interactive Brokers',
          type: 'BROKERAGE',
          baseCurrency: 'PLN',
          createdAt: '2026-03-20T12:00:00Z',
          updatedAt: '2026-03-20T12:00:00Z',
        },
        {
          id: 'acc-bonds',
          name: 'Rejestr obligacji',
          institution: 'Obligacje Skarbowe',
          type: 'BOND_REGISTER',
          baseCurrency: 'PLN',
          createdAt: '2026-03-20T12:05:00Z',
          updatedAt: '2026-03-20T12:05:00Z',
        },
      ])
    }

    if (url.includes('/api/v1/instruments')) {
      return jsonResponse([
        {
          id: 'ins-vwra',
          name: 'VWRA',
          kind: 'ETF',
          assetClass: 'EQUITIES',
          symbol: 'VWRA.L',
          currency: 'USD',
          valuationSource: 'STOCK_ANALYST',
          edoTerms: null,
          createdAt: '2026-03-20T12:00:00Z',
          updatedAt: '2026-03-20T12:00:00Z',
        },
        {
          id: 'ins-edo',
          name: 'EDO0135',
          kind: 'BOND_EDO',
          assetClass: 'BONDS',
          symbol: null,
          currency: 'PLN',
          valuationSource: 'EDO_CALCULATOR',
          edoTerms: {
            seriesMonth: '2025-01',
            firstPeriodRateBps: 650,
            marginBps: 200,
          },
          createdAt: '2026-03-20T12:10:00Z',
          updatedAt: '2026-03-20T12:10:00Z',
        },
      ])
    }

    if (url.includes('/api/v1/transactions/import/profiles')) {
      return jsonResponse([
        {
          id: 'profile-1',
          name: 'IBKR CSV',
          separator: ',',
          quoteChar: '"',
          headerMappings: {},
          defaults: {
            accountId: 'acc-broker',
            skipDuplicatesByDefault: true,
          },
          createdAt: '2026-03-26T12:00:00Z',
          updatedAt: '2026-03-27T08:00:00Z',
        },
      ])
    }

    if (url.includes('/api/v1/transactions')) {
      return jsonResponse([
        {
          id: 'txn-1',
          accountId: 'acc-broker',
          instrumentId: null,
          type: 'DEPOSIT',
          tradeDate: '2026-03-20',
          quantity: null,
          grossAmount: '10000.00',
          feeAmount: '0.00',
          taxAmount: '0.00',
          currency: 'PLN',
          fxRateToPln: null,
          note: null,
          createdAt: '2026-03-20T10:00:00Z',
          updatedAt: '2026-03-20T10:00:00Z',
        },
      ])
    }

    if (url.includes('/api/v1/portfolio/audit/events')) {
      return jsonResponse([
        {
          id: 'audit-1',
          happenedAt: '2026-03-27T08:00:00Z',
          category: 'IMPORTS',
          action: 'TRANSACTION_IMPORT_PREVIEW_COMPLETED',
          outcome: 'SUCCESS',
          summary: 'Import preview completed.',
          impact: 'LOW',
          metadata: {},
        },
      ])
    }

    if (url.includes('/api/v1/portfolio/benchmark-settings')) {
      return jsonResponse({
        enabledKeys: ['CUSTOM', 'VWRA'],
        pinnedKeys: ['CUSTOM'],
        customLabel: 'Europa 600',
        customSymbol: 'EXSA.DE',
        options: [
          {
            key: 'VWRA',
            label: 'VWRA benchmark',
            symbol: 'VWRA.L',
            kind: 'ETF',
            configurable: true,
            defaultEnabled: true,
            defaultPinned: true,
          },
          {
            key: 'TARGET_MIX',
            label: 'Configured target mix',
            symbol: null,
            kind: 'SYSTEM',
            configurable: false,
            defaultEnabled: true,
            defaultPinned: false,
          },
          {
            key: 'CUSTOM',
            label: 'Custom benchmark',
            symbol: 'EXSA.DE',
            kind: 'ETF',
            configurable: true,
            defaultEnabled: false,
            defaultPinned: false,
          },
        ],
      })
    }

    throw new Error(`Unhandled fetch in app smoke test: ${url}`)
  })
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}
