import { useQuery } from '@tanstack/react-query'
import { fetchAppReadiness } from '../api/system'

export function useAppReadiness() {
  return useQuery({
    queryKey: ['app-readiness'],
    queryFn: fetchAppReadiness,
    staleTime: 300_000,
  })
}
