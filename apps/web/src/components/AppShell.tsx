import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession, useLogout } from '../hooks/use-auth-session'

interface AppShellProps {
  children: ReactNode
}

interface NavItem {
  to: string
  label: string
  copy: string
  section: string
  title: string
  subtitle: string
  end?: boolean
}

const primaryNavItems: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    copy: 'Current value, allocation and operational health.',
    end: true,
    section: 'Investing',
    title: 'Portfolio dashboard',
    subtitle: 'Current value, allocation drift and portfolio health at a glance.',
  },
  {
    to: '/holdings',
    label: 'Holdings',
    copy: 'Positions, account exposure and valuation coverage.',
    section: 'Investing',
    title: 'Holdings',
    subtitle: 'Inspect positions by account, asset class and valuation status.',
  },
  {
    to: '/performance',
    label: 'Performance',
    copy: 'History, returns and benchmark context.',
    section: 'Investing',
    title: 'Performance',
    subtitle: 'History, returns and benchmark context in one coherent read-heavy view.',
  },
  {
    to: '/transactions',
    label: 'Transactions',
    copy: 'Journal, imports and canonical event history.',
    section: 'Investing',
    title: 'Transactions',
    subtitle: 'Manage the canonical events that drive valuation, history and returns.',
  },
] 

const secondaryNavItems: NavItem[] = [
  {
    to: '/settings',
    label: 'Settings',
    copy: 'Reference data, backups, cache and state transfer.',
    section: 'Operations',
    title: 'Settings',
    subtitle: 'Accounts, instruments, backups, transfer workflows and read-model cache.',
  },
]

const navItems = [...primaryNavItems, ...secondaryNavItems]

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const metaQuery = useAppMeta()
  const authSessionQuery = useAuthSession()
  const logoutMutation = useLogout()
  const authState = authSessionQuery.data
  const activeItem = navItems.find((item) => item.to === location.pathname) ?? primaryNavItems[0]
  const systemStatus = metaQuery.isError ? 'Degraded' : metaQuery.isLoading ? 'Connecting' : 'Healthy'
  const authSummary = authState?.authEnabled ? 'Password protected' : 'Single-user local mode'

  return (
    <div className="layout app-frame">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <span className="shell-chip">Self-hosted portfolio tracker</span>
          <div className="shell-brand-mark">
            <span className="shell-brand-label">Portfolio</span>
            <h1 className="shell-brand-title">Calm by default.</h1>
          </div>
          <p className="shell-brand-copy">
            Transaction-based accounting, long-term performance and backup workflows in one focused workspace.
          </p>
        </div>

        <nav className="shell-nav-group" aria-label="Primary">
          <div className="shell-nav-section">
            <span className="shell-nav-label">Investing</span>
            <div className="shell-nav-list">
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  aria-label={item.label}
                  className={({ isActive }) => (isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link')}
                >
                  <span className="shell-nav-link-title">{item.label}</span>
                  <span className="shell-nav-link-copy">{item.copy}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="shell-nav-section">
            <span className="shell-nav-label">Operations</span>
            <div className="shell-nav-list">
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={({ isActive }) => (isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link')}
                >
                  <span className="shell-nav-link-title">{item.label}</span>
                  <span className="shell-nav-link-copy">{item.copy}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <div className="shell-status-card">
          <div className="shell-status-header">
            <div className="shell-status-title">
              <strong>System status</strong>
              <p>{metaQuery.data ? `${metaQuery.data.name} ${metaQuery.data.stage.toUpperCase()}` : 'Connecting API'}</p>
            </div>
            <span className={`shell-status-chip ${metaQuery.isError ? 'shell-status-chip-degraded' : 'shell-status-chip-healthy'}`}>
              {systemStatus}
            </span>
          </div>

          <div className="shell-status-grid">
            <div className="shell-status-row">
              <span>Storage</span>
              <strong>{metaQuery.data?.stack.database ?? 'SQLite'}</strong>
            </div>
            <div className="shell-status-row">
              <span>Access</span>
              <strong>{authSummary}</strong>
            </div>
            <div className="shell-status-row">
              <span>Capabilities</span>
              <strong>{metaQuery.data?.capabilities.length ?? 0}</strong>
            </div>
          </div>

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

      <main className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar-copy">
            <span className="shell-topbar-label">{activeItem.section}</span>
            <h2 className="shell-topbar-title">{activeItem.title}</h2>
            <p className="shell-topbar-subtitle">{activeItem.subtitle}</p>
          </div>

          <div className="shell-topbar-badges">
            <span className="shell-topbar-badge">{systemStatus}</span>
            {metaQuery.data ? <span className="shell-topbar-badge">{metaQuery.data.stage.toUpperCase()}</span> : null}
            <span className="shell-topbar-badge">{authSummary}</span>
          </div>
        </header>

        <div className="content shell-content">{children}</div>
      </main>
    </div>
  )
}
