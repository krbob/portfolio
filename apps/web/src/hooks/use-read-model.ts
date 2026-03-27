import { useQuery } from '@tanstack/react-query'
import {
  fetchMarketDataSnapshots,
  fetchPortfolioAccounts,
  fetchPortfolioAllocation,
  fetchPortfolioAuditEvents,
  fetchPortfolioDailyHistory,
  fetchPortfolioHoldings,
  fetchPortfolioOverview,
  fetchReadModelCacheSnapshots,
  fetchPortfolioReturns,
} from '../api/read-model'

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
