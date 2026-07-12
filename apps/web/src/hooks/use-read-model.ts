import { useMutation, useQuery } from '@tanstack/react-query'
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

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ['portfolio-overview'],
    queryFn: fetchPortfolioOverview,
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
    queryKey: ['portfolio-market-data-snapshots'],
    queryFn: fetchMarketDataSnapshots,
  })
}
