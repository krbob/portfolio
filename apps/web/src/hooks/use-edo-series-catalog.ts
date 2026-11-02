import { useQuery } from '@tanstack/react-query'
import { getEdoSeriesCatalog } from '../api/write-model'

export function useEdoSeriesCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ['edo-series-catalog'],
    queryFn: getEdoSeriesCatalog,
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}
