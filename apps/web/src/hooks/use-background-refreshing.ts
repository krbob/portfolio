export function useBackgroundRefreshing(queries: Array<{ isFetching: boolean; isLoading: boolean }>): boolean {
  return queries.some((q) => q.isFetching && !q.isLoading)
}
