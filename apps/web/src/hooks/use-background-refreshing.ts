import type { UseQueryResult } from '@tanstack/react-query'

export function useBackgroundRefreshing(queries: UseQueryResult[]): boolean {
  return queries.some((q) => q.isFetching && !q.isLoading)
}
