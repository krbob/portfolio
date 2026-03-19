import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PortfolioDailyHistoryPoint } from '../api/read-model'
import { AllocationBar } from '../components/AllocationBar'
import { PortfolioAllocationSection } from '../components/PortfolioAllocationSection'
import { PortfolioValueChart } from '../components/PortfolioValueChart'
import { usePortfolioAuditEvents, usePortfolioDailyHistory, usePortfolioOverview } from '../hooks/use-read-model'
import { usePortfolioBackups } from '../hooks/use-write-model'
import { formatCurrencyPln, formatDateTime, formatPercent, formatSignedCurrencyPln } from '../lib/format'

const shortcuts = [
  {
    to: '/holdings',
    label: 'Inspect holdings',
    description: 'Review positions, valuation coverage and account exposure.',
  },
  {
    to: '/transactions',
    label: 'Manage transactions',
    description: 'Review journal changes and run imports safely.',
  },
  {
    to: '/settings#backups',
    label: 'Check backups',
    description: 'Inspect the latest server snapshots and restore history.',
  },
]

type DashboardRange = '1Y' | 'MAX'

export function DashboardScreen() {
  const [range, setRange] = useState<DashboardRange>('1Y')
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const auditEventsQuery = usePortfolioAuditEvents({ limit: 5 })
  const backupsQuery = usePortfolioBackups()
  const overview = overviewQuery.data
  const allPoints = historyQuery.data?.points ?? []
  const chartPoints = useMemo(() => filterHistoryPoints(allPoints, range), [allPoints, range])
  const latestPoint = chartPoints.at(-1) ?? allPoints.at(-1)
  const previousPoint = chartPoints.at(-2) ?? allPoints.at(-2)
  const dailyChange =
    latestPoint && previousPoint
      ? Number(latestPoint.totalCurrentValuePln) - Number(previousPoint.totalCurrentValuePln)
      : null
  const dailyChangePct =
    dailyChange != null && previousPoint && Number(previousPoint.totalCurrentValuePln) !== 0
      ? (dailyChange / Number(previousPoint.totalCurrentValuePln)) * 100
      : null
  const totalCurrentValue = overview ? Number(overview.totalCurrentValuePln) : 0
  const equityWeightPct =
    overview && totalCurrentValue > 0 ? (Number(overview.equityCurrentValuePln) / totalCurrentValue) * 100 : 0
  const bondWeightPct =
    overview && totalCurrentValue > 0 ? (Number(overview.bondCurrentValuePln) / totalCurrentValue) * 100 : 0
  const cashWeightPct =
    overview && totalCurrentValue > 0 ? (Number(overview.cashCurrentValuePln) / totalCurrentValue) * 100 : 0
  const lastBackup = backupsQuery.data?.backups[0] ?? null
  const auditEvents = auditEventsQuery.data ?? []
  const openIssues = overview
    ? overview.valuationIssueCount + overview.missingFxTransactions + overview.unsupportedCorrectionTransactions
    : 0
  const issueRows = [
    {
      label: 'Valuation gaps',
      value: overview?.valuationIssueCount ?? 0,
      tone: (overview?.valuationIssueCount ?? 0) > 0 ? 'warning' : 'healthy',
    },
    {
      label: 'Missing FX',
      value: overview?.missingFxTransactions ?? 0,
      tone: (overview?.missingFxTransactions ?? 0) > 0 ? 'warning' : 'healthy',
    },
    {
      label: 'Unsupported corrections',
      value: overview?.unsupportedCorrectionTransactions ?? 0,
      tone: (overview?.unsupportedCorrectionTransactions ?? 0) > 0 ? 'warning' : 'healthy',
    },
    {
      label: 'Backups on server',
      value: backupsQuery.data?.backups.length ?? 0,
      tone: (backupsQuery.data?.backups.length ?? 0) > 0 ? 'info' : 'warning',
    },
  ]

  return (
    <div className="page-stack">
      <section className="dashboard-hero-grid">
        <article className="panel dashboard-hero-card">
          <div className="dashboard-hero-header">
            <div className="dashboard-hero-copy">
              <p className="eyebrow">Portfolio</p>
              <h3 className="dashboard-hero-value">
                {overview ? formatCurrencyPln(overview.totalCurrentValuePln) : 'Loading...'}
              </h3>
              <p className="dashboard-hero-subtitle">
                {latestPoint
                  ? `As of ${latestPoint.date} · ${overview?.accountCount ?? 0} accounts · ${overview?.activeHoldingCount ?? 0} active holdings`
                  : 'Waiting for the latest valuation snapshot.'}
              </p>
            </div>

            <div className="history-pill-group" role="tablist" aria-label="Dashboard chart range">
              {(['1Y', 'MAX'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === range ? 'unit-pill unit-pill-active' : 'unit-pill'}
                  onClick={() => setRange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-metric-strip">
            <article className="dashboard-metric-card">
              <span>Daily move</span>
              <strong className={gainClassName(dailyChange)}>
                {dailyChange != null ? formatSignedCurrencyPln(dailyChange) : 'Unavailable'}
              </strong>
              <p>
                {dailyChangePct != null
                  ? `${formatPercent(dailyChangePct, { signed: true })} versus previous valuation day`
                  : 'Waiting for another history point.'}
              </p>
            </article>

            <article className="dashboard-metric-card">
              <span>Unrealized P/L</span>
              <strong className={gainClassName(overview ? Number(overview.totalUnrealizedGainPln) : null)}>
                {overview ? formatSignedCurrencyPln(overview.totalUnrealizedGainPln) : 'Unavailable'}
              </strong>
              <p>Book basis versus latest market value.</p>
            </article>

            <article className="dashboard-metric-card">
              <span>Net contributions</span>
              <strong>{overview ? formatCurrencyPln(overview.netContributionsPln) : 'Unavailable'}</strong>
              <p>Total external cash added across all accounts.</p>
            </article>

            <article className="dashboard-metric-card">
              <span>Valuation coverage</span>
              <strong>
                {overview ? `${overview.valuedHoldingCount}/${overview.activeHoldingCount}` : 'Unavailable'}
              </strong>
              <p>{overview ? `${openIssues} items still require attention.` : 'Loading valuation state.'}</p>
            </article>
          </div>

          <div className="dashboard-chart-card">
            {historyQuery.isLoading ? (
              <p className="muted-copy">Loading dashboard history...</p>
            ) : historyQuery.isError ? (
              <p className="form-error">{historyQuery.error.message}</p>
            ) : chartPoints.length === 0 ? (
              <p className="muted-copy">No history yet.</p>
            ) : (
              <PortfolioValueChart
                contributionsKey="netContributionsPln"
                description={range === '1Y' ? 'Current value versus contributions over the last year in' : 'Current value versus contributions over full history in'}
                height={260}
                points={chartPoints}
                title="Portfolio value"
                unit="PLN"
                valueKey="totalCurrentValuePln"
              />
            )}
          </div>
        </article>

        <div className="dashboard-side-stack">
          <article className="panel dashboard-snapshot-card">
            <div className="section-header">
              <p className="eyebrow">Allocation</p>
              <h3>Allocation snapshot</h3>
              <p>Current mix by market value with a quick read on the live split.</p>
            </div>

            <AllocationBar
              bondWeightPct={bondWeightPct}
              cashWeightPct={cashWeightPct}
              compact
              equityWeightPct={equityWeightPct}
            />

            <dl className="dashboard-stat-list">
              <div>
                <dt>Equities</dt>
                <dd>
                  {overview
                    ? `${formatCurrencyPln(overview.equityCurrentValuePln)} · ${formatPercent(equityWeightPct)}`
                    : 'Loading...'}
                </dd>
              </div>
              <div>
                <dt>Bonds</dt>
                <dd>
                  {overview
                    ? `${formatCurrencyPln(overview.bondCurrentValuePln)} · ${formatPercent(bondWeightPct)}`
                    : 'Loading...'}
                </dd>
              </div>
              <div>
                <dt>Cash</dt>
                <dd>
                  {overview
                    ? `${formatCurrencyPln(overview.cashCurrentValuePln)} · ${formatPercent(cashWeightPct)}`
                    : 'Loading...'}
                </dd>
              </div>
            </dl>
          </article>

          <article className="panel dashboard-snapshot-card">
            <div className="section-header">
              <p className="eyebrow">Health</p>
              <h3>Portfolio health</h3>
              <p>Data quality, backup coverage and unresolved issues.</p>
            </div>

            <div className="dashboard-issue-list">
              {issueRows.map((issue) => (
                <article className="dashboard-issue-row" key={issue.label}>
                  <div>
                    <strong>{issue.label}</strong>
                    <p>{issue.value === 0 ? 'Nothing open.' : `${issue.value} item${issue.value === 1 ? '' : 's'} open.`}</p>
                  </div>
                  <span className={`status-badge status-${issue.tone}`}>{issue.value}</span>
                </article>
              ))}
            </div>

            <p className="muted-copy">
              {lastBackup ? `Latest backup ${formatDateTime(lastBackup.createdAt)}.` : 'No server backup recorded yet.'}
            </p>
          </article>
        </div>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="panel dashboard-feed-card">
          <div className="section-header">
            <p className="eyebrow">Operations</p>
            <h3>Recent activity</h3>
            <p>Latest backup, import and restore events from the append-only audit log.</p>
          </div>

          {auditEventsQuery.isLoading && <p className="muted-copy">Loading recent activity...</p>}
          {auditEventsQuery.isError && <p className="form-error">{auditEventsQuery.error.message}</p>}
          {!auditEventsQuery.isLoading && !auditEventsQuery.isError && auditEvents.length === 0 && (
            <p className="muted-copy">No operational events recorded yet.</p>
          )}
          {!auditEventsQuery.isLoading && !auditEventsQuery.isError && auditEvents.length > 0 && (
            <div className="audit-feed">
              {auditEvents.map((event) => (
                <article className="audit-event" key={event.id}>
                  <div className="audit-event-header">
                    <div>
                      <strong>{event.message}</strong>
                      <p>
                        {event.category} · {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                    <span className={`status-badge ${event.outcome === 'FAILURE' ? 'status-unavailable' : 'status-valued'}`}>
                      {event.outcome}
                    </span>
                  </div>
                  {event.entityId ? <p className="audit-event-entity">{event.entityId}</p> : null}
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel dashboard-feed-card">
          <div className="section-header">
            <p className="eyebrow">Actions</p>
            <h3>Next actions</h3>
            <p>Fast paths into the places you are most likely to need next.</p>
          </div>

          <div className="dashboard-action-list">
            {shortcuts.map((shortcut) => (
              <Link key={shortcut.to} className="dashboard-action-link" to={shortcut.to}>
                <strong>{shortcut.label}</strong>
                <p>{shortcut.description}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <PortfolioAllocationSection />
    </div>
  )
}

function filterHistoryPoints(points: PortfolioDailyHistoryPoint[], range: DashboardRange) {
  if (range === 'MAX' || points.length === 0) {
    return points
  }

  const latestDate = new Date(points.at(-1)?.date ?? points[0].date)
  const cutoff = new Date(latestDate)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  const cutoffString = cutoff.toISOString().slice(0, 10)
  return points.filter((point) => point.date >= cutoffString)
}

function gainClassName(value: number | null) {
  if (value == null) {
    return undefined
  }
  if (value > 0) {
    return 'value-positive'
  }
  if (value < 0) {
    return 'value-negative'
  }
  return undefined
}
