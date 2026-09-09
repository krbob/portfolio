import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import {
  fetchMarketDataSnapshots,
  fetchPortfolioAccounts,
  fetchPortfolioAllocation,
  fetchPortfolioAlerts,
  fetchPortfolioAuditEvents,
  fetchPortfolioContributionPlan,
  fetchPortfolioDailyHistory,
  fetchPortfolioHoldings,
  fetchPortfolioOverview,
  previewPortfolioManualContribution,
  fetchReadModelCacheSnapshots,
  fetchPortfolioReturns,
  type ManualContributionPreviewPayload,
} from '../api/read-model'
import { useI18n } from '../lib/i18n'
import { DEFAULT_QUERY_STALE_TIME_MS, LIVE_QUERY_STALE_TIME_MS } from '../lib/query-client'

export const PORTFOLIO_OVERVIEW_QUERY_KEY = ['portfolio-overview'] as const
export const MARKET_DATA_SNAPSHOTS_QUERY_KEY = ['portfolio-market-data-snapshots'] as const

const marketDataReads = new WeakMap<QueryClient, { active: number; generation: number }>()

export function usePortfolioOverview({ enabled = true }: { enabled?: boolean } = {}) {
  return useMarketDataReadQuery({
    queryKey: PORTFOLIO_OVERVIEW_QUERY_KEY,
    queryFn: fetchPortfolioOverview,
    enabled,
  })
}

export function usePortfolioHoldings() {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-holdings'],
    queryFn: fetchPortfolioHoldings,
  })
}

export function usePortfolioAccounts() {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-accounts'],
    queryFn: fetchPortfolioAccounts,
  })
}

export function usePortfolioDailyHistory() {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-daily-history'],
    queryFn: fetchPortfolioDailyHistory,
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
}

export function usePortfolioReturns() {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-returns'],
    queryFn: fetchPortfolioReturns,
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
}

export function usePortfolioAllocation() {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-allocation'],
    queryFn: fetchPortfolioAllocation,
  })
}

export function usePortfolioAlerts() {
  const { language } = useI18n()
  return useMarketDataReadQuery({
    queryKey: ['portfolio-alerts', language],
    queryFn: () => fetchPortfolioAlerts(language),
  })
}

export function usePortfolioContributionPlan(
  amountPln: string | null,
  revision = 0,
  { equitiesTargetWeightPct }: { equitiesTargetWeightPct?: string | null } = {},
) {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-allocation-contribution-plan', amountPln ?? '', revision, equitiesTargetWeightPct ?? 'BASE'],
    queryFn: () => fetchPortfolioContributionPlan(amountPln ?? '', { equitiesTargetWeightPct }),
    enabled: amountPln != null,
  })
}

export function usePortfolioManualContributionPreview() {
  return useMutation({
    mutationFn: (payload: ManualContributionPreviewPayload) => previewPortfolioManualContribution(payload),
  })
}

export function usePortfolioAuditEvents({ limit = 12, category }: { limit?: number; category?: string } = {}) {
  return useQuery({
    queryKey: ['portfolio-audit-events', limit, category ?? 'ALL'],
    queryFn: () => fetchPortfolioAuditEvents({ limit, category }),
  })
}

export function useReadModelCacheSnapshots() {
  return useQuery({
    queryKey: ['portfolio-read-model-cache'],
    queryFn: fetchReadModelCacheSnapshots,
  })
}

export function useMarketDataSnapshots() {
  return useQuery({
    queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchMarketDataSnapshots(signal),
    staleTime: LIVE_QUERY_STALE_TIME_MS,
  })
}

function useMarketDataReadQuery<T>(options: {
  queryKey: QueryKey
  queryFn: () => Promise<T>
  enabled?: boolean
  staleTime?: number
}) {
  const queryClient = useQueryClient()
  return useQuery({
    staleTime: LIVE_QUERY_STALE_TIME_MS,
    ...options,
    queryFn: async () => {
      const finishRead = beginMarketDataRead(queryClient)
      try {
        return await options.queryFn()
      } finally {
        await finishRead()
      }
    },
  })
}

function beginMarketDataRead(queryClient: QueryClient) {
  let reads = marketDataReads.get(queryClient)
  if (!reads) {
    reads = { active: 0, generation: 0 }
    marketDataReads.set(queryClient, reads)
  }
  const batch = reads
  batch.active++
  batch.generation++

  return async () => {
    batch.active--
    if (batch.active > 0) return

    // Read the final diagnostics once all concurrent valuation/analytics reads
    // settle, including failures. Cancel an older diagnostics response first.
    const generation = batch.generation
    await queryClient.cancelQueries({ queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY })
    if (batch.active > 0 || batch.generation !== generation) return
    void queryClient.invalidateQueries({
      queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY,
      refetchType: 'active',
    })
  }
}
