import type { components, paths } from './generated/portfolio-api'

export type PortfolioOverview =
  paths['/v1/portfolio/overview']['get']['responses'][200]['content']['application/json']

export type PortfolioHolding =
  paths['/v1/portfolio/holdings']['get']['responses'][200]['content']['application/json'][number]

export type PortfolioDailyHistory =
  paths['/v1/portfolio/history/daily']['get']['responses'][200]['content']['application/json']

export type PortfolioDailyHistoryPoint =
  components['schemas']['PortfolioDailyHistoryPointResponse']

export type PortfolioReturns =
  paths['/v1/portfolio/returns']['get']['responses'][200]['content']['application/json']

export type PortfolioAllocationSummary =
  paths['/v1/portfolio/allocation']['get']['responses'][200]['content']['application/json']

export type PortfolioAuditEvent =
  paths['/v1/portfolio/audit/events']['get']['responses'][200]['content']['application/json'][number]

export type ReadModelCacheSnapshot =
  paths['/v1/portfolio/read-model-cache']['get']['responses'][200]['content']['application/json'][number]

export type PortfolioAllocationBucket =
  components['schemas']['PortfolioAllocationBucketResponse']

export type PortfolioReturnPeriod =
  components['schemas']['PortfolioReturnPeriodResponse']

export type ReturnMetric =
  components['schemas']['ReturnMetricResponse']

export type BenchmarkComparison =
  components['schemas']['BenchmarkComparisonResponse']

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

export function fetchPortfolioAuditEvents({
  limit = 12,
  category,
}: {
  limit?: number
  category?: string
} = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (category) {
    params.set('category', category)
  }

  return requestJson<PortfolioAuditEvent[]>(`/api/v1/portfolio/audit/events?${params.toString()}`)
}

export function fetchReadModelCacheSnapshots() {
  return requestJson<ReadModelCacheSnapshot[]>('/api/v1/portfolio/read-model-cache')
}
