import { QueryClient, keepPreviousData } from '@tanstack/react-query'

export const DEFAULT_QUERY_STALE_TIME_MS = 30_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_QUERY_STALE_TIME_MS,
      retry: 1,
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
    },
    mutations: {
      retry: false,
    },
  },
})
