import { useAppReadiness } from '../hooks/use-app-readiness'
import { Card, SectionHeader } from './ui'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelReadinessStatus } from '../lib/labels'
import { badge, badgeVariants } from '../lib/styles'

export function SystemReadinessSection() {
  const { isPolish } = useI18n()
  const readinessQuery = useAppReadiness()
  const readiness = readinessQuery.data

  return (
    <Card>
      <SectionHeader
        eyebrow={isPolish ? 'Stan systemu' : 'Health'}
        title={isPolish ? 'Gotowość środowiska' : 'Runtime readiness'}
        description={isPolish
          ? 'Zweryfikuj storage, backupy, integracje danych rynkowych i uwierzytelnianie, zanim zaufasz stanowi portfela.'
          : 'Verify storage, backups, market-data wiring and authentication before trusting the portfolio state.'}
      />

      {readinessQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Sprawdzanie zależności środowiska...' : 'Checking runtime dependencies...'}</p>}
      {readinessQuery.isError && <p className="text-sm text-red-400">{readinessQuery.error.message}</p>}

      {readiness && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Stan ogólny' : 'Overall status'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">{formatOverallStatus(readiness.status)}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Blokery' : 'Blocking issues'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">{countChecks(readiness.checks, 'FAIL')}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Uwagi' : 'Advisory notices'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">
                {countChecks(readiness.checks, 'WARN') + countChecks(readiness.checks, 'INFO')}
              </strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Sprawdzone o' : 'Checked at'}</span>
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
                    {labelCheckStatus(check.status, isPolish)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{check.message}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function countChecks(
  checks: Array<{ status: string }>,
  status: 'FAIL' | 'WARN' | 'INFO' | 'PASS',
) {
  return checks.filter((check) => check.status === status).length
}

function formatOverallStatus(status: string) {
  return labelReadinessStatus(status)
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

function labelCheckStatus(status: string, isPolish: boolean) {
  if (!isPolish) {
    return status
  }

  switch (status) {
    case 'PASS':
      return 'OK'
    case 'WARN':
      return 'UWAGA'
    case 'FAIL':
      return 'BŁĄD'
    case 'INFO':
      return 'INFO'
    default:
      return status
  }
}
