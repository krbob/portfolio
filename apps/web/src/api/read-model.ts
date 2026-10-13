import type { components, paths } from './generated/portfolio-api'
import { requestJson, requestResponse } from './http'
import type { UiLanguage } from '../lib/i18n'

export type PortfolioOverview =
  paths['/v1/portfolio/overview']['get']['responses'][200]['content']['application/json']

type GeneratedPortfolioHolding =
  paths['/v1/portfolio/holdings']['get']['responses'][200]['content']['application/json'][number]

type GeneratedPortfolioHoldingEdoLot =
  NonNullable<GeneratedPortfolioHolding['edoLots']>[number]

export type PortfolioHolding =
  Omit<GeneratedPortfolioHolding, 'edoLots'> & {
    currentPriceNative?: string | null
    edoLots?: Array<GeneratedPortfolioHoldingEdoLot & { currentPriceNative?: string | null }>
  }

export type PortfolioAccountSummary =
  paths['/v1/portfolio/accounts']['get']['responses'][200]['content']['application/json'][number]

export type PortfolioDailyHistory =
  paths['/v1/portfolio/history/daily']['get']['responses'][200]['content']['application/json']

export type PortfolioDailyHistoryPoint =
  components['schemas']['PortfolioDailyHistoryPointResponse']

export type PortfolioReturns =
  paths['/v1/portfolio/returns']['get']['responses'][200]['content']['application/json']

export type PortfolioAllocationSummary =
  paths['/v1/portfolio/allocation']['get']['responses'][200]['content']['application/json']

export type PortfolioContributionPlan =
  paths['/v1/portfolio/allocation/contribution-plan']['get']['responses'][200]['content']['application/json']

export type PortfolioManualContributionPreview =
  paths['/v1/portfolio/allocation/manual-contribution-preview']['post']['responses'][200]['content']['application/json']

export type ManualContributionPreviewPayload =
  NonNullable<paths['/v1/portfolio/allocation/manual-contribution-preview']['post']['requestBody']>['content']['application/json']

export type PortfolioAuditEvent =
  paths['/v1/portfolio/audit/events']['get']['responses'][200]['content']['application/json'][number]

export type ReadModelCacheSnapshot =
  paths['/v1/portfolio/read-model-cache']['get']['responses'][200]['content']['application/json'][number]

export type MarketDataSnapshot =
  paths['/v1/portfolio/market-data-snapshots']['get']['responses'][200]['content']['application/json'][number]

export type PortfolioAllocationBucket =
  components['schemas']['PortfolioAllocationBucketResponse']

export type PortfolioReturnPeriod =
  components['schemas']['PortfolioReturnPeriodResponse']

export type ReturnMetric =
  components['schemas']['ReturnMetricResponse']

export type RollingReturnWindow =
  components['schemas']['RollingReturnWindowResponse']

export type PortfolioDrawdowns =
  components['schemas']['PortfolioDrawdownsResponse']

export type DrawdownEpisode =
  components['schemas']['DrawdownEpisodeResponse']

export type BenchmarkComparison =
  components['schemas']['BenchmarkComparisonResponse']

export type PortfolioAlert =
  paths['/v1/portfolio/alerts']['get']['responses'][200]['content']['application/json'][number]

export function fetchPortfolioOverview({ preferCached = false, signal }: { preferCached?: boolean; signal?: AbortSignal } = {}) {
  return requestJson<PortfolioOverview>(
    `/api/v1/portfolio/overview${preferCached ? '?preferCached=true' : ''}`,
    { signal },
  )
}

export function fetchPortfolioHoldings() {
  return requestJson<PortfolioHolding[]>('/api/v1/portfolio/holdings')
}

export function fetchPortfolioAccounts() {
  return requestJson<PortfolioAccountSummary[]>('/api/v1/portfolio/accounts')
}

export function fetchPortfolioDailyHistory(options: ReadModelReadOptions = {}) {
  return requestReadModel<PortfolioDailyHistory>('/api/v1/portfolio/history/daily', options)
}

export function fetchPortfolioReturns(options: ReadModelReadOptions = {}) {
  return requestReadModel<PortfolioReturns>('/api/v1/portfolio/returns', options)
}

export function fetchPortfolioAllocation() {
  return requestJson<PortfolioAllocationSummary>('/api/v1/portfolio/allocation')
}

export function fetchPortfolioAlerts(language: UiLanguage, options: ReadModelReadOptions = {}) {
  return requestReadModel<PortfolioAlert[]>('/api/v1/portfolio/alerts', options, { 'Accept-Language': language })
}

export interface ReadModelSnapshot {
  generatedAt: string
  fromCache: boolean
  refreshRequired: boolean
  refreshFailed: boolean
}
export interface ReadModelResponse<T> { value: T; snapshot?: ReadModelSnapshot }
export interface ReadModelReadOptions { preferCached?: boolean; signal?: AbortSignal }

async function requestReadModel<T>(path: string, { preferCached = false, signal }: ReadModelReadOptions, headers = {}): Promise<ReadModelResponse<T>> {
  const response = await requestResponse(`${path}?preferCached=${preferCached}`, { signal, headers })
  const generatedAt = response.headers.get('X-Read-Model-Generated-At')
  return {
    value: await response.json() as T,
    snapshot: generatedAt ? {
      generatedAt,
      fromCache: response.headers.get('X-Read-Model-From-Cache') === 'true',
      refreshRequired: response.headers.get('X-Read-Model-Refresh-Required') === 'true',
      refreshFailed: response.headers.get('X-Read-Model-Refresh-Failed') === 'true',
    } : undefined,
  }
}

export function fetchPortfolioContributionPlan(
  amountPln: string,
  { equitiesTargetWeightPct }: { equitiesTargetWeightPct?: string | null } = {},
) {
  const params = new URLSearchParams()
  params.set('amountPln', amountPln)
  if (equitiesTargetWeightPct) {
    params.set('equitiesTargetWeightPct', equitiesTargetWeightPct)
  }
  return requestJson<PortfolioContributionPlan>(`/api/v1/portfolio/allocation/contribution-plan?${params.toString()}`)
}

export function previewPortfolioManualContribution(payload: ManualContributionPreviewPayload) {
  return requestJson<PortfolioManualContributionPreview>('/api/v1/portfolio/allocation/manual-contribution-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export function fetchMarketDataSnapshots(signal?: AbortSignal) {
  return requestJson<MarketDataSnapshot[]>('/api/v1/portfolio/market-data-snapshots', { signal })
}
