import { useQuery } from '@tanstack/react-query'
import { fetchAppMeta } from '../api/meta'

export function useAppMeta() {
  return useQuery({
    queryKey: ['app-meta'],
    queryFn: fetchAppMeta,
    staleTime: 60_000,
  })
}
