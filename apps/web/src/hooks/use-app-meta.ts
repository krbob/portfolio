import { useQuery } from '@tanstack/react-query'
import { fetchAppMeta } from '../api/meta'
import { shouldRetryStartupQuery, startupQueryRetryDelay } from '../lib/startup-query-retry'

export function useAppMeta() {
  return useQuery({
    queryKey: ['app-meta'],
    queryFn: fetchAppMeta,
    staleTime: 60_000,
    retry: shouldRetryStartupQuery,
    retryDelay: startupQueryRetryDelay,
  })
}
