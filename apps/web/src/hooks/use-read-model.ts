import { useQuery } from '@tanstack/react-query'
import {
  fetchPortfolioDailyHistory,
  fetchPortfolioHoldings,
  fetchPortfolioOverview,
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

export function usePortfolioDailyHistory() {
  return useQuery({
    queryKey: ['portfolio-daily-history'],
    queryFn: fetchPortfolioDailyHistory,
  })
}
