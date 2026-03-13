import { useQuery } from '@tanstack/react-query'
import {
  fetchPortfolioDailyHistory,
  fetchPortfolioHoldings,
  fetchPortfolioOverview,
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
