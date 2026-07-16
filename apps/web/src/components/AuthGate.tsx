import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_UNAUTHORIZED_EVENT } from '../api/http'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession, useLogin } from '../hooks/use-auth-session'
import { t } from '../lib/messages'
import { FieldError, StatePanel } from './ui'
import { btnPrimary, input, inputError, label as labelClass } from '../lib/styles'

interface AuthGateProps {
  children: ReactNode
}

const OFFLINE_SHELL_MARKER = 'portfolio:offline-shell:auth-disabled-v1'

export function AuthGate({ children }: AuthGateProps) {
  const queryClient = useQueryClient()
  const metaQuery = useAppMeta()
  const authSessionQuery = useAuthSession()
  const missingStartupData = !metaQuery.data || !authSessionQuery.data
  const startupRequestInFlight = metaQuery.isFetching || authSessionQuery.isFetching

  function retryStartup() {
    void Promise.all([metaQuery.refetch(), authSessionQuery.refetch()])
  }

  useEffect(() => {
    const handleUnauthorized = () => {
      void queryClient.invalidateQueries({ queryKey: ['auth-session'] })
    }

    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [queryClient])

  useEffect(() => {
    const session = authSessionQuery.data
    if (!session) return

    try {
      if (!session.authEnabled && session.authenticated) {
        window.localStorage.setItem(OFFLINE_SHELL_MARKER, 'true')
      } else {
        window.localStorage.removeItem(OFFLINE_SHELL_MARKER)
      }
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
  }, [authSessionQuery.data])

  if (metaQuery.isLoading || authSessionQuery.isLoading || (missingStartupData && startupRequestInFlight)) {
    if (canRenderOfflineShell()) {
      return <>{children}</>
    }
    return (
      <AuthLayout>
        <StatePanel
          eyebrow={t('auth.connecting')}
          title={t('auth.checkingSession')}
          description={t('auth.checkingSessionDesc')}
          className="border-0 bg-transparent p-0"
        />
      </AuthLayout>
    )
  }

  if (metaQuery.isError || authSessionQuery.isError || !metaQuery.data || !authSessionQuery.data) {
    if (canRenderOfflineShell()) {
      return <>{children}</>
    }
    return (
      <AuthLayout>
        <StatePanel
          eyebrow={t('auth.connectionIssue')}
          title={t('auth.notReachable')}
          description={t('auth.startupRetryDescription')}
          action={{ label: t('common.retry'), onClick: retryStartup }}
          tone="error"
          className="border-0 bg-transparent p-0"
        />
      </AuthLayout>
    )
  }

  if (authSessionQuery.data.authEnabled && !authSessionQuery.data.authenticated) {
    return <LoginCard stage={metaQuery.data.stage} />
  }

  return <>{children}</>
}

function canRenderOfflineShell(): boolean {
  if (typeof navigator === 'undefined' || navigator.onLine) return false
  try {
    return window.localStorage.getItem(OFFLINE_SHELL_MARKER) === 'true'
  } catch {
    return false
  }
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
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-100">Portfolio</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
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
            <label>
              <span className={labelClass}>{t('auth.password')}</span>
              <input
                type="password"
                className={loginMutation.isError ? inputError : input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t('auth.enterPassword')}
              />
            </label>
            <FieldError
              message={loginMutation.isError
                ? (loginMutation.error instanceof Error ? loginMutation.error.message : t('auth.loginFailed'))
                : null}
            />

            <button
              type="submit"
              className={`${btnPrimary} mt-4 w-full`}
              disabled={loginMutation.isPending || password.trim().length === 0}
            >
              {loginMutation.isPending ? t('auth.unlocking') : t('auth.unlock')}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-400">{t('auth.selfHosted')}</p>
      </div>
    </div>
  )
}
