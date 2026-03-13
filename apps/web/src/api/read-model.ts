export interface PortfolioOverview {
  asOf: string
  valuationState: string
  totalBookValuePln: string
  investedBookValuePln: string
  cashBalancePln: string
  netContributionsPln: string
  equityBookValuePln: string
  bondBookValuePln: string
  cashBookValuePln: string
  accountCount: number
  instrumentCount: number
  activeHoldingCount: number
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
  transactionCount: number
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
