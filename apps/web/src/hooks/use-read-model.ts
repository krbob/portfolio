import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
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

export const PORTFOLIO_OVERVIEW_QUERY_KEY = ['portfolio-overview'] as const
export const MARKET_DATA_SNAPSHOTS_QUERY_KEY = ['portfolio-market-data-snapshots'] as const

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
  })
}

export function usePortfolioReturns() {
  return useMarketDataReadQuery({
    queryKey: ['portfolio-returns'],
    queryFn: fetchPortfolioReturns,
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
  })
}

function useMarketDataReadQuery<T>(options: {
  queryKey: QueryKey
  queryFn: () => Promise<T>
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn()
      } finally {
        // Every valuation or analytics read can update upstream diagnostics,
        // including a failed read. Discard any earlier status response and read
        // the resulting state without delaying the portfolio response.
        await queryClient.cancelQueries({ queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY })
        void queryClient.invalidateQueries({
          queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY,
          refetchType: 'active',
        })
      }
    },
  })
}
