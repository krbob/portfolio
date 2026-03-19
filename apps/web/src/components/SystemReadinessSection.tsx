import { SectionCard } from './SectionCard'
import { useAppReadiness } from '../hooks/use-app-readiness'
import { formatDateTime } from '../lib/format'

export function SystemReadinessSection() {
  const readinessQuery = useAppReadiness()
  const readiness = readinessQuery.data

  return (
    <SectionCard
      eyebrow="Health"
      title="Runtime readiness"
      description="Verify storage, backups, market-data wiring and authentication before trusting the portfolio state."
    >
      {readinessQuery.isLoading && <p className="muted-copy">Checking runtime dependencies...</p>}
      {readinessQuery.isError && <p className="form-error">{readinessQuery.error.message}</p>}

      {readiness && (
        <>
          <div className="summary-grid readiness-summary-grid">
            <article className="overview-stat">
              <span>Overall status</span>
              <strong>{formatOverallStatus(readiness.status)}</strong>
            </article>
            <article className="overview-stat">
              <span>Blocking issues</span>
              <strong>{countChecks(readiness.checks, 'FAIL')}</strong>
            </article>
            <article className="overview-stat">
              <span>Advisory notices</span>
              <strong>{countChecks(readiness.checks, 'WARN') + countChecks(readiness.checks, 'INFO')}</strong>
            </article>
            <article className="overview-stat">
              <span>Checked at</span>
              <strong>{formatDateTime(readiness.checkedAt)}</strong>
            </article>
          </div>

          <div className="readiness-grid">
            {readiness.checks.map((check) => (
              <article className="readiness-check" key={check.key}>
                <div className="readiness-check-header">
                  <div>
                    <strong>{check.label}</strong>
                    <p className="muted-copy">{check.key}</p>
                  </div>
                  <span className={`status-badge ${readinessStatusClassName(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                <p className="readiness-check-message">{check.message}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </SectionCard>
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

function readinessStatusClassName(status: string) {
  switch (status) {
    case 'PASS':
      return 'status-valued'
    case 'WARN':
      return 'status-underweight'
    case 'FAIL':
      return 'status-unavailable'
    case 'INFO':
      return 'status-info'
    default:
      return 'status-unconfigured'
  }
}
