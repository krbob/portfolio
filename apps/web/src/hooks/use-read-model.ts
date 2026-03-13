import { useQuery } from '@tanstack/react-query'
import { fetchPortfolioHoldings, fetchPortfolioOverview } from '../api/read-model'

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
