import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAuthSession, deleteAuthSession, fetchAuthSession, type CreateAuthSessionPayload } from '../api/auth'

export function useAuthSession() {
  return useQuery({
    queryKey: ['auth-session'],
    queryFn: fetchAuthSession,
    staleTime: 30_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateAuthSessionPayload) => createAuthSession(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteAuthSession(),
    onSuccess: async () => {
      queryClient.removeQueries({
        predicate: (query) => {
          const [root] = query.queryKey
          return root !== 'app-meta' && root !== 'auth-session'
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] })
    },
  })
}
