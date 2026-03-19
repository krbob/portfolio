import { NavLink } from 'react-router-dom'
import { useAppMeta } from '../../hooks/use-app-meta'
import { useAppReadiness } from '../../hooks/use-app-readiness'
import { useAuthSession, useLogout } from '../../hooks/use-auth-session'
import { StatusDot } from '../ui/StatusDot'
import { btnGhost } from '../../lib/styles'
import { navSections, type NavItem } from './navigation'

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

function NavSection({
  label,
  items,
  onNavigate,
}: {
  label: string
  items: NavItem[]
  onNavigate?: () => void
}) {
  return (
    <div className="mb-6">
      <span className="mb-2 block px-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-2 border-blue-500 bg-zinc-800 text-zinc-100 pl-2.5'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Sidebar({ className = '', onNavigate }: SidebarProps) {
  const metaQuery = useAppMeta()
  const readinessQuery = useAppReadiness()
  const authSessionQuery = useAuthSession()
  const logoutMutation = useLogout()

  const systemStatus = resolveStatus(metaQuery.isError, readinessQuery.isError, readinessQuery.data?.status)

  return (
    <nav className={`flex h-full min-h-0 w-full flex-col bg-zinc-900/80 ${className}`} aria-label="Primary navigation">
      <div className="px-5 py-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Portfolio</h1>
        <p className="mt-1 text-xs text-zinc-600">Long-term investing workspace</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {navSections.map((section) => (
          <NavSection
            key={section.label}
            label={section.label}
            items={section.items}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="border-t border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-2">
          <StatusDot status={systemStatus.dot} />
          <span className="text-xs text-zinc-500">{systemStatus.label}</span>
        </div>
        {metaQuery.data && (
          <p className="mt-1 text-xs text-zinc-600">
            {metaQuery.data.stack.database} · {metaQuery.data.stage}
          </p>
        )}
        {authSessionQuery.data?.authEnabled && (
          <button
            type="button"
            className={`mt-2 w-full text-left ${btnGhost}`}
            onClick={() => {
              onNavigate?.()
              logoutMutation.mutate()
            }}
            disabled={logoutMutation.isPending}
            title="Sign out"
          >
            {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
          </button>
        )}
      </div>
    </nav>
  )
}

function resolveStatus(
  metaError: boolean,
  readinessError: boolean,
  readinessStatus: string | undefined,
): { dot: 'healthy' | 'warning' | 'error' | 'unknown'; label: string } {
  if (metaError || readinessError) return { dot: 'error', label: 'Degraded' }
  if (!readinessStatus) return { dot: 'unknown', label: 'Connecting' }
  if (readinessStatus === 'READY') return { dot: 'healthy', label: 'Healthy' }
  if (readinessStatus === 'DEGRADED') return { dot: 'warning', label: 'Degraded' }
  return { dot: 'error', label: 'Not ready' }
}
