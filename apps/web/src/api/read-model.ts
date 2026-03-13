export interface PortfolioOverview {
  asOf: string
  valuationState: string
  totalBookValuePln: string
  totalCurrentValuePln: string
  investedBookValuePln: string
  investedCurrentValuePln: string
  cashBalancePln: string
  netContributionsPln: string
  equityBookValuePln: string
  equityCurrentValuePln: string
  bondBookValuePln: string
  bondCurrentValuePln: string
  cashBookValuePln: string
  cashCurrentValuePln: string
  totalUnrealizedGainPln: string
  accountCount: number
  instrumentCount: number
  activeHoldingCount: number
  valuedHoldingCount: number
  unvaluedHoldingCount: number
  valuationIssueCount: number
  missingFxTransactions: number
  unsupportedCorrectionTransactions: number
}

export interface PortfolioHolding {
  accountId: string
  accountName: string
  instrumentId: string
  instrumentName: string
  kind: string
  assetClass: string
  currency: string
  quantity: string
  averageCostPerUnitPln: string
  costBasisPln: string
  bookValuePln: string
  currentPricePln: string | null
  currentValuePln: string | null
  unrealizedGainPln: string | null
  valuedAt: string | null
  valuationStatus: string
  valuationIssue: string | null
  transactionCount: number
}

export interface PortfolioDailyHistory {
  from: string
  until: string
  valuationState: string
  instrumentHistoryIssueCount: number
  referenceSeriesIssueCount: number
  missingFxTransactions: number
  unsupportedCorrectionTransactions: number
  points: PortfolioDailyHistoryPoint[]
}

export interface PortfolioDailyHistoryPoint {
  date: string
  totalBookValuePln: string
  totalCurrentValuePln: string
  netContributionsPln: string
  cashBalancePln: string
  totalCurrentValueUsd: string | null
  netContributionsUsd: string | null
  cashBalanceUsd: string | null
  totalCurrentValueAu: string | null
  netContributionsAu: string | null
  cashBalanceAu: string | null
  equityCurrentValuePln: string
  bondCurrentValuePln: string
  cashCurrentValuePln: string
  equityAllocationPct: string
  bondAllocationPct: string
  cashAllocationPct: string
  activeHoldingCount: number
  valuedHoldingCount: number
}

export interface PortfolioReturns {
  asOf: string
  periods: PortfolioReturnPeriod[]
}

export interface PortfolioAllocationSummary {
  asOf: string
  valuationState: string
  configured: boolean
  targetWeightSumPct: string
  totalCurrentValuePln: string
  availableCashPln: string
  buckets: PortfolioAllocationBucket[]
}

export interface PortfolioAllocationBucket {
  assetClass: string
  currentValuePln: string
  currentWeightPct: string
  targetWeightPct: string | null
  targetValuePln: string | null
  driftPctPoints: string | null
  gapValuePln: string | null
  suggestedContributionPln: string
  status: 'UNDERWEIGHT' | 'OVERWEIGHT' | 'ON_TARGET' | 'UNCONFIGURED'
}

export interface PortfolioReturnPeriod {
  key: string
  label: string
  requestedFrom: string
  from: string
  until: string
  clippedToInception: boolean
  dayCount: number
  nominalPln: ReturnMetric | null
  nominalUsd: ReturnMetric | null
  realPln: ReturnMetric | null
  inflationFrom: string | null
  inflationUntil: string | null
  inflationMultiplier: string | null
}

export interface ReturnMetric {
  moneyWeightedReturn: string
  annualizedMoneyWeightedReturn: string | null
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path)

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Keep fallback.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function fetchPortfolioOverview() {
  return requestJson<PortfolioOverview>('/api/v1/portfolio/overview')
}

export function fetchPortfolioHoldings() {
  return requestJson<PortfolioHolding[]>('/api/v1/portfolio/holdings')
}

export function fetchPortfolioDailyHistory() {
  return requestJson<PortfolioDailyHistory>('/api/v1/portfolio/history/daily')
}

export function fetchPortfolioReturns() {
  return requestJson<PortfolioReturns>('/api/v1/portfolio/returns')
}

export function fetchPortfolioAllocation() {
  return requestJson<PortfolioAllocationSummary>('/api/v1/portfolio/allocation')
}
