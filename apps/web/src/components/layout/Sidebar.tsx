import { NavLink } from 'react-router-dom'
import { useAppMeta } from '../../hooks/use-app-meta'
import { useAppReadiness } from '../../hooks/use-app-readiness'
import { useAuthSession, useLogout } from '../../hooks/use-auth-session'
import { StatusDot } from '../ui/StatusDot'
import { btnGhost } from '../../lib/styles'
import { navSections, type NavItem } from './navigation'
import { useI18n } from '../../lib/i18n'

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
  const { language } = useI18n()

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
              title={item.label[language]}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors [webkit-tap-highlight-color:transparent] active:bg-zinc-800 ${
                  isActive
                    ? 'border-l-2 border-blue-500 bg-zinc-800 text-zinc-100 pl-2.5'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`
              }
            >
              {item.icon}
              <span>{item.label[language]}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Sidebar({ className = '', onNavigate }: SidebarProps) {
  const { isPolish } = useI18n()
  const metaQuery = useAppMeta()
  const readinessQuery = useAppReadiness()
  const authSessionQuery = useAuthSession()
  const logoutMutation = useLogout()

  const systemStatus = resolveStatus(metaQuery.isError, readinessQuery.isError, readinessQuery.data?.status, isPolish)
  const blockingChecks = countChecks(readinessQuery.data?.checks, 'FAIL')
  const advisoryChecks = countChecks(readinessQuery.data?.checks, 'WARN') + countChecks(readinessQuery.data?.checks, 'INFO')

  return (
    <nav className={`flex h-full min-h-0 w-full flex-col bg-zinc-900/80 ${className}`} aria-label="Primary navigation">
      <div className="px-5 py-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Portfolio</h1>
        <p className="mt-1 text-xs text-zinc-600">
          {isPolish ? 'Przestrzeń do długoterminowego inwestowania' : 'Long-term investing workspace'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {navSections.map((section) => (
          <NavSection
            key={section.label.en}
            label={isPolish ? section.label.pl : section.label.en}
            items={section.items}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="border-t border-zinc-800 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusDot status={systemStatus.dot} />
            <span className="text-xs font-medium text-zinc-400">
              {isPolish ? 'Stan środowiska' : 'Runtime health'}
            </span>
          </div>
          <span className="text-xs text-zinc-500">{systemStatus.label}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          {readinessQuery.isLoading
            ? (isPolish ? 'Sprawdzanie zależności...' : 'Checking dependencies...')
            : readinessQuery.isError
              ? (isPolish ? 'Nie udało się odpytać endpointu gotowości.' : 'Could not reach readiness endpoint.')
              : isPolish
                ? `${blockingChecks} blokad · ${advisoryChecks} uwag`
                : `${blockingChecks} blockers · ${advisoryChecks} notices`}
        </p>
        <NavLink
          to="/settings#health"
          onClick={onNavigate}
          className="mt-2 inline-flex text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {isPolish ? 'Otwórz stan systemu' : 'Open health'}
        </NavLink>
        {authSessionQuery.data?.authEnabled && (
          <button
            type="button"
            className={`mt-2 w-full text-left ${btnGhost}`}
            onClick={() => {
              onNavigate?.()
              logoutMutation.mutate()
            }}
            disabled={logoutMutation.isPending}
            title={isPolish ? 'Wyloguj' : 'Sign out'}
          >
            {logoutMutation.isPending
              ? (isPolish ? 'Wylogowywanie...' : 'Signing out...')
              : (isPolish ? 'Wyloguj' : 'Sign out')}
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
  isPolish: boolean,
): { dot: 'healthy' | 'warning' | 'error' | 'unknown'; label: string } {
  if (metaError || readinessError) return { dot: 'error', label: isPolish ? 'Ograniczony' : 'Degraded' }
  if (!readinessStatus) return { dot: 'unknown', label: isPolish ? 'Łączenie' : 'Connecting' }
  if (readinessStatus === 'READY') return { dot: 'healthy', label: isPolish ? 'Gotowy' : 'Healthy' }
  if (readinessStatus === 'DEGRADED') return { dot: 'warning', label: isPolish ? 'Ograniczony' : 'Degraded' }
  return { dot: 'error', label: isPolish ? 'Niegotowy' : 'Not ready' }
}

function countChecks(checks: Array<{ status: string }> | undefined, status: 'FAIL' | 'WARN' | 'INFO') {
  if (!checks) {
    return 0
  }

  return checks.filter((check) => check.status === status).length
}
