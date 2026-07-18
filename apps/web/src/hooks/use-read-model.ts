import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function usePortfolioOverview() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: PORTFOLIO_OVERVIEW_QUERY_KEY,
    queryFn: async () => {
      const overview = await fetchPortfolioOverview()

      // Fetching the overview can refresh upstream quotes and their persisted
      // diagnostics. Cancel a snapshot request that started before the overview
      // so its older response cannot win the race, then read the same state.
      await queryClient.cancelQueries({ queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY })
      void queryClient.invalidateQueries({
        queryKey: MARKET_DATA_SNAPSHOTS_QUERY_KEY,
        refetchType: 'active',
      })
      return overview
    },
  })
}

export function usePortfolioHoldings() {
  return useQuery({
    queryKey: ['portfolio-holdings'],
    queryFn: fetchPortfolioHoldings,
  })
}

export function usePortfolioAccounts() {
  return useQuery({
    queryKey: ['portfolio-accounts'],
    queryFn: fetchPortfolioAccounts,
  })
}

export function usePortfolioDailyHistory() {
  return useQuery({
    queryKey: ['portfolio-daily-history'],
    queryFn: fetchPortfolioDailyHistory,
  })
}

export function usePortfolioReturns() {
  return useQuery({
    queryKey: ['portfolio-returns'],
    queryFn: fetchPortfolioReturns,
  })
}

export function usePortfolioAllocation() {
  return useQuery({
    queryKey: ['portfolio-allocation'],
    queryFn: fetchPortfolioAllocation,
  })
}

export function usePortfolioAlerts() {
  const { language } = useI18n()
  return useQuery({
    queryKey: ['portfolio-alerts', language],
    queryFn: () => fetchPortfolioAlerts(language),
  })
}

export function usePortfolioContributionPlan(
  amountPln: string | null,
  revision = 0,
  { equitiesTargetWeightPct }: { equitiesTargetWeightPct?: string | null } = {},
) {
  return useQuery({
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
