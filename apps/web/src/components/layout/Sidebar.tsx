import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { useAppMeta } from '../../hooks/use-app-meta'
import { useAppReadiness } from '../../hooks/use-app-readiness'
import { useAuthSession, useLogout } from '../../hooks/use-auth-session'
import { StatusDot } from '../ui/StatusDot'
import { btnGhost } from '../../lib/styles'
import { navSections, type NavItem } from './navigation'
import { useI18n } from '../../lib/i18n'
import { formatMessage, t } from '../../lib/messages'

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
                clsx(
                  'flex select-none items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-[background-color,color,border-color] [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:border-blue-400 focus-visible:bg-zinc-800/80 focus-visible:ring-2 focus-visible:ring-blue-500/20 active:bg-zinc-800',
                  isActive
                    ? 'border-blue-500 bg-zinc-800 text-zinc-100'
                    : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300',
                )
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
  const { language } = useI18n()
  const metaQuery = useAppMeta()
  const readinessQuery = useAppReadiness()
  const authSessionQuery = useAuthSession()
  const logoutMutation = useLogout()

  const blockingChecks = countChecks(readinessQuery.data?.checks, 'FAIL')
  const advisoryChecks = countChecks(readinessQuery.data?.checks, 'WARN') + countChecks(readinessQuery.data?.checks, 'INFO')
  const systemStatus = resolveStatus({
    metaError: metaQuery.isError,
    readinessError: readinessQuery.isError,
    readinessStatus: readinessQuery.data?.status,
    blockingChecks,
    advisoryChecks,
  })

  return (
    <nav className={`flex h-full min-h-0 w-full flex-col bg-zinc-900/80 ${className}`} aria-label={t('layout.navigation')}>
      <div className="px-5 py-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Portfolio</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {navSections.map((section) => (
          <NavSection
            key={section.label.en}
            label={section.label[language]}
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
              {t('layout.runtimeHealth')}
            </span>
          </div>
          <span className="text-xs text-zinc-500">{systemStatus.label}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {readinessQuery.isLoading
            ? t('layout.checkingDeps')
            : readinessQuery.isError
              ? t('layout.readinessUnreachable')
              : formatMessage(t('layout.healthSummary'), { blockers: blockingChecks, notices: advisoryChecks })}
        </p>
        <NavLink
          to="/settings#health"
          onClick={onNavigate}
          className="mt-2 inline-flex text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {t('layout.openHealth')}
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
            title={t('layout.signOut')}
          >
            {logoutMutation.isPending
              ? t('layout.signingOut')
              : t('layout.signOut')}
          </button>
        )}
      </div>
    </nav>
  )
}

function resolveStatus({
  metaError,
  readinessError,
  readinessStatus,
  blockingChecks,
  advisoryChecks,
}: {
  metaError: boolean
  readinessError: boolean
  readinessStatus: string | undefined
  blockingChecks: number
  advisoryChecks: number
}): { dot: 'healthy' | 'warning' | 'error' | 'unknown'; label: string } {
  if (metaError || readinessError) return { dot: 'error', label: t('layout.statusError') }
  if (!readinessStatus) return { dot: 'unknown', label: t('layout.statusConnecting') }
  if (readinessStatus === 'READY') return { dot: 'healthy', label: t('layout.statusHealthy') }
  if (readinessStatus === 'DEGRADED') {
    if (blockingChecks > 0) {
      return { dot: 'warning', label: t('layout.statusDegraded') }
    }
    if (advisoryChecks > 0) {
      return { dot: 'warning', label: t('layout.statusAdvisory') }
    }
    return { dot: 'warning', label: t('layout.statusDegraded') }
  }
  return { dot: 'error', label: t('layout.statusNotReady') }
}

function countChecks(checks: Array<{ status: string }> | undefined, status: 'FAIL' | 'WARN' | 'INFO') {
  if (!checks) {
    return 0
  }

  return checks.filter((check) => check.status === status).length
}
