import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession, useLogout } from '../hooks/use-auth-session'

interface AppShellProps {
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/holdings', label: 'Holdings' },
  { to: '/returns', label: 'Returns' },
  { to: '/charts', label: 'Charts' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/data', label: 'Data' },
  { to: '/backups', label: 'Backups' },
]

export function AppShell({ children }: AppShellProps) {
  const metaQuery = useAppMeta()
  const authSessionQuery = useAuthSession()
  const logoutMutation = useLogout()
  const authState = authSessionQuery.data

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <p className="sidebar-label">Portfolio</p>
          <h1 className="sidebar-title">Long-term investing, tracked with intent.</h1>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className="sidebar-status-label">System</span>
          <strong>{metaQuery.isError ? 'Degraded' : metaQuery.isLoading ? 'Loading' : 'Healthy'}</strong>
          <p>{metaQuery.data ? `${metaQuery.data.name} ${metaQuery.data.stage.toUpperCase()}` : 'Connecting API'}</p>
          <p>{authState?.authEnabled ? `Protected by ${authState.mode.toLowerCase()} auth` : 'Open local mode'}</p>
          {authState?.authEnabled ? (
            <button
              type="button"
              className="sidebar-action"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
            </button>
          ) : null}
        </div>
      </aside>

      <main className="content-shell">
        <div className="content">{children}</div>
      </main>
    </div>
  )
}
