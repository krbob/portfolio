import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_UNAUTHORIZED_EVENT } from '../api/http'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession, useLogin } from '../hooks/use-auth-session'
import { useI18n } from '../lib/i18n'
import { SectionHeader } from './ui'
import { btnPrimary, input } from '../lib/styles'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { isPolish } = useI18n()
  const queryClient = useQueryClient()
  const metaQuery = useAppMeta()
  const authSessionQuery = useAuthSession()
  const startupErrorMessage =
    metaQuery.error instanceof Error
        ? metaQuery.error.message
      : authSessionQuery.error instanceof Error
        ? authSessionQuery.error.message
        : isPolish
          ? 'Aplikacja nie mogła wczytać wymaganego stanu startowego.'
          : 'The app could not load required startup state.'

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
        <SectionHeader
          eyebrow={isPolish ? 'Łączenie' : 'Connecting'}
          title={isPolish ? 'Sprawdzanie sesji' : 'Checking session'}
          description={isPolish ? 'Ładowanie metadanych i stanu uwierzytelnienia.' : 'Loading metadata and authentication state.'}
        />
      </AuthLayout>
    )
  }

  if (metaQuery.isError || authSessionQuery.isError || !metaQuery.data || !authSessionQuery.data) {
    return (
      <AuthLayout>
        <SectionHeader
          eyebrow={isPolish ? 'Problem z połączeniem' : 'Connection issue'}
          title={isPolish ? 'Nie można połączyć się z Portfolio' : 'Portfolio is not reachable'}
          description={startupErrorMessage}
        />
      </AuthLayout>
    )
  }

  if (authSessionQuery.data.authEnabled && !authSessionQuery.data.authenticated) {
    return <LoginCard stage={metaQuery.data.stage} isPolish={isPolish} />
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

function LoginCard({ stage, isPolish }: { stage: string; isPolish: boolean }) {
  const loginMutation = useLogin()
  const [password, setPassword] = useState('')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-100">Portfolio</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {stage}
            </p>
          </div>

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
              aria-label={isPolish ? 'Hasło' : 'Password'}
              placeholder={isPolish ? 'Wpisz hasło' : 'Enter password'}
            />

            <button
              type="submit"
              className={`${btnPrimary} mt-4 w-full`}
              disabled={loginMutation.isPending || password.trim().length === 0}
            >
              {loginMutation.isPending ? (isPolish ? 'Odblokowywanie...' : 'Unlocking...') : (isPolish ? 'Odblokuj' : 'Unlock')}
            </button>
          </form>

          {loginMutation.isError && (
            <p className="mt-3 text-sm text-red-400">
              {loginMutation.error instanceof Error ? loginMutation.error.message : isPolish ? 'Logowanie nie powiodło się.' : 'Login failed.'}
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-600">{isPolish ? 'Self-hosted tracker portfela' : 'Self-hosted portfolio tracker'}</p>
      </div>
    </div>
  )
}
