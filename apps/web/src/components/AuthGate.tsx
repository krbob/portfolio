import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_UNAUTHORIZED_EVENT } from '../api/http'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession, useLogin } from '../hooks/use-auth-session'

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
      <div className="auth-layout">
        <section className="auth-card">
          <p className="eyebrow">Connecting</p>
          <h1 className="auth-title">Checking session status</h1>
          <p className="auth-copy">The app is loading public metadata and current authentication state.</p>
        </section>
      </div>
    )
  }

  if (metaQuery.isError || authSessionQuery.isError || !metaQuery.data || !authSessionQuery.data) {
    return (
      <div className="auth-layout">
        <section className="auth-card">
          <p className="eyebrow">Connection issue</p>
          <h1 className="auth-title">Portfolio is not reachable</h1>
          <p className="auth-copy">
            {metaQuery.error instanceof Error
              ? metaQuery.error.message
              : authSessionQuery.error instanceof Error
                ? authSessionQuery.error.message
                : 'The app could not load required startup state.'}
          </p>
        </section>
      </div>
    )
  }

  if (authSessionQuery.data.authEnabled && !authSessionQuery.data.authenticated) {
    return <LoginCard appName={metaQuery.data.name} stage={metaQuery.data.stage} />
  }

  return <>{children}</>
}

function LoginCard({ appName, stage }: { appName: string; stage: string }) {
  const loginMutation = useLogin()
  const [password, setPassword] = useState('')

  return (
    <div className="auth-layout">
      <section className="auth-card">
        <p className="eyebrow">{stage.toUpperCase()}</p>
        <h1 className="auth-title">{appName} is locked</h1>
        <p className="auth-copy">
          Password protection is enabled for this self-hosted instance. Enter the shared password to unlock the
          dashboard and data operations.
        </p>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            loginMutation.mutate({ password })
          }}
        >
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter instance password"
            />
          </label>

          <button
            type="submit"
            className="button-primary"
            disabled={loginMutation.isPending || password.trim().length === 0}
          >
            {loginMutation.isPending ? 'Unlocking...' : 'Unlock portfolio'}
          </button>
        </form>

        {loginMutation.isError ? (
          <p className="auth-error">
            {loginMutation.error instanceof Error ? loginMutation.error.message : 'Login failed.'}
          </p>
        ) : null}
      </section>
    </div>
  )
}
