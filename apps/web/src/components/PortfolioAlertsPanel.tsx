import { Link } from 'react-router-dom'
import type { PortfolioAlert } from '../api/read-model'
import { t } from '../lib/messages'
import { appRoutes } from '../lib/routes'
import { badge, badgeVariants, btnSecondary } from '../lib/styles'
import { IconWarning } from './ui/icons'

interface PortfolioAlertsPanelProps {
  alerts: PortfolioAlert[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

export function PortfolioAlertsPanel({
  alerts,
  isLoading,
  isError,
  onRetry,
}: PortfolioAlertsPanelProps) {
  if (isLoading && alerts.length === 0) {
    return null
  }

  if (isError && alerts.length === 0) {
    return (
      <section className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-200">{t('portfolioAlerts.unavailableTitle')}</p>
            <p className="mt-1 text-sm text-red-100/80">{t('portfolioAlerts.unavailableDescription')}</p>
          </div>
          <button type="button" onClick={onRetry} className={btnSecondary}>
            {t('common.retry')}
          </button>
        </div>
      </section>
    )
  }

  if (alerts.length === 0) {
    return null
  }

  const critical = alerts.some((alert) => alert.severity === 'CRITICAL')
  const panelClass = critical
    ? 'border-red-500/35 bg-red-500/10'
    : 'border-amber-500/35 bg-amber-500/10'
  const iconClass = critical ? 'text-red-300' : 'text-amber-300'

  return (
    <section className={`mt-4 rounded-xl border p-4 ${panelClass}`} aria-live="polite">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconWarning className={`h-5 w-5 ${iconClass}`} />
          <h2 className="text-sm font-semibold text-zinc-100">{t('portfolioAlerts.title')}</h2>
        </div>
        <span className={`${badge} ${critical ? badgeVariants.error : badgeVariants.warning}`}>
          {labelAlertCount(alerts.length)}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <article key={alert.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${badge} ${alert.severity === 'CRITICAL' ? badgeVariants.error : badgeVariants.warning}`}>
                  {labelSeverity(alert.severity)}
                </span>
                <p className="text-sm font-medium text-zinc-100">{alert.title}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{alert.message}</p>
            </div>
            <Link
              to={safeAlertRoute(alert.route)}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              {t('portfolioAlerts.open')}
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}

function labelAlertCount(count: number) {
  if (count === 1) {
    return t('portfolioAlerts.countOne')
  }

  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) {
    return `${count} ${t('portfolioAlerts.countFew')}`
  }

  return `${count} ${t('portfolioAlerts.countMany')}`
}

function labelSeverity(severity: string) {
  switch (severity) {
    case 'CRITICAL':
      return t('portfolioAlerts.severityCritical')
    case 'INFO':
      return t('portfolioAlerts.severityInfo')
    case 'WARNING':
    default:
      return t('portfolioAlerts.severityWarning')
  }
}

function safeAlertRoute(route: string) {
  return route.startsWith('/') ? route : appRoutes.dashboard
}
