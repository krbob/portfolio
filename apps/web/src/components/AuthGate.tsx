import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_UNAUTHORIZED_EVENT } from '../api/http'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession, useLogin } from '../hooks/use-auth-session'
import { btnPrimary, input } from '../lib/styles'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const queryClient = useQueryClient()
  const metaQuery = useAppMeta()
  const authSessionQuery = useAuthSession()

  useEffect(() => {
    const handleUnauthorized = () => {
      void queryClient.invalidateQueries({ queryKey: ['auth-session'] })
    }

    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [queryClient])

  if (metaQuery.isLoading || authSessionQuery.isLoading) {
    return (
      <AuthLayout>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Connecting</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">Checking session</h1>
        <p className="mt-2 text-sm text-zinc-500">Loading metadata and authentication state.</p>
      </AuthLayout>
    )
  }

  if (metaQuery.isError || authSessionQuery.isError || !metaQuery.data || !authSessionQuery.data) {
    return (
      <AuthLayout>
        <p className="text-xs font-medium uppercase tracking-wider text-red-400">Connection issue</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">Portfolio is not reachable</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {metaQuery.error instanceof Error
            ? metaQuery.error.message
            : authSessionQuery.error instanceof Error
              ? authSessionQuery.error.message
              : 'The app could not load required startup state.'}
        </p>
      </AuthLayout>
    )
  }

  if (authSessionQuery.data.authEnabled && !authSessionQuery.data.authenticated) {
    return <LoginCard stage={metaQuery.data.stage} />
  }

  return <>{children}</>
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        {children}
      </div>
    </div>
  )
}

function LoginCard({ stage }: { stage: string }) {
  const loginMutation = useLogin()
  const [password, setPassword] = useState('')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="text-center text-2xl font-bold text-zinc-100">Portfolio</h1>
          <p className="mt-1 text-center text-xs text-zinc-500">{stage.toUpperCase()}</p>

          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault()
              loginMutation.mutate({ password })
            }}
          >
            <input
              type="password"
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter password"
            />

            <button
              type="submit"
              className={`${btnPrimary} mt-4 w-full`}
              disabled={loginMutation.isPending || password.trim().length === 0}
            >
              {loginMutation.isPending ? 'Unlocking...' : 'Unlock'}
            </button>
          </form>

          {loginMutation.isError && (
            <p className="mt-3 text-sm text-red-400">
              {loginMutation.error instanceof Error ? loginMutation.error.message : 'Login failed.'}
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-600">Self-hosted portfolio tracker</p>
      </div>
    </div>
  )
}
