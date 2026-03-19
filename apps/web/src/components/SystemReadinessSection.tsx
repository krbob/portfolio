import { useAppReadiness } from '../hooks/use-app-readiness'
import { formatDateTime } from '../lib/format'
import { card, badge, badgeVariants } from '../lib/styles'

export function SystemReadinessSection() {
  const readinessQuery = useAppReadiness()
  const readiness = readinessQuery.data

  return (
    <div className={card}>
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Health</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-100">Runtime readiness</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Verify storage, backups, market-data wiring and authentication before trusting the portfolio state.
        </p>
      </div>

      {readinessQuery.isLoading && <p className="text-sm text-zinc-500">Checking runtime dependencies...</p>}
      {readinessQuery.isError && <p className="text-sm text-red-400">{readinessQuery.error.message}</p>}

      {readiness && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">Overall status</span>
              <strong className="mt-1 block text-sm text-zinc-100">{formatOverallStatus(readiness.status)}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">Blocking issues</span>
              <strong className="mt-1 block text-sm text-zinc-100">{countChecks(readiness.checks, 'FAIL')}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">Advisory notices</span>
              <strong className="mt-1 block text-sm text-zinc-100">
                {countChecks(readiness.checks, 'WARN') + countChecks(readiness.checks, 'INFO')}
              </strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">Checked at</span>
              <strong className="mt-1 block text-sm text-zinc-100">{formatDateTime(readiness.checkedAt)}</strong>
            </article>
          </div>

          <div className="space-y-3">
            {readiness.checks.map((check) => (
              <article className="rounded-lg border border-zinc-800/50 p-4" key={check.key}>
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-sm text-zinc-100">{check.label}</strong>
                    <p className="text-sm text-zinc-500">{check.key}</p>
                  </div>
                  <span className={`${badge} ${readinessBadgeVariant(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{check.message}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function countChecks(
  checks: Array<{ status: string }>,
  status: 'FAIL' | 'WARN' | 'INFO' | 'PASS',
) {
  return checks.filter((check) => check.status === status).length
}

function formatOverallStatus(status: string) {
  switch (status) {
    case 'READY':
      return 'Ready'
    case 'DEGRADED':
      return 'Degraded'
    case 'NOT_READY':
      return 'Not ready'
    default:
      return status
  }
}

function readinessBadgeVariant(status: string) {
  switch (status) {
    case 'PASS':
      return badgeVariants.success
    case 'WARN':
      return badgeVariants.warning
    case 'FAIL':
      return badgeVariants.error
    case 'INFO':
      return badgeVariants.info
    default:
      return badgeVariants.default
  }
}
