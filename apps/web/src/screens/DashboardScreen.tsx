import { Link } from 'react-router-dom'
import { AllocationBar } from '../components/AllocationBar'
import { PortfolioAllocationSection } from '../components/PortfolioAllocationSection'
import { usePortfolioAuditEvents, usePortfolioDailyHistory, usePortfolioOverview } from '../hooks/use-read-model'
import { usePortfolioBackups } from '../hooks/use-write-model'
import { formatCurrencyPln, formatDateTime, formatPercent, formatSignedCurrencyPln } from '../lib/format'

const shortcuts = [
  {
    to: '/holdings',
    label: 'Inspect holdings',
    description: 'Review positions, valuation coverage and account-level exposure.',
  },
  {
    to: '/transactions',
    label: 'Manage transactions',
    description: 'Add, edit and import the raw events that drive all read models.',
  },
  {
    to: '/settings#backups',
    label: 'Check backups',
    description: 'Inspect server snapshots before running restore or import operations.',
  },
]

export function DashboardScreen() {
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const auditEventsQuery = usePortfolioAuditEvents({ limit: 6 })
  const backupsQuery = usePortfolioBackups()
  const overview = overviewQuery.data
  const latestHistoryPoint = historyQuery.data?.points.at(-1)
  const previousHistoryPoint = historyQuery.data?.points.at(-2)
  const dailyChange =
    latestHistoryPoint && previousHistoryPoint
      ? Number(latestHistoryPoint.totalCurrentValuePln) - Number(previousHistoryPoint.totalCurrentValuePln)
      : null
  const dailyChangePct =
    dailyChange != null && previousHistoryPoint && Number(previousHistoryPoint.totalCurrentValuePln) !== 0
      ? (dailyChange / Number(previousHistoryPoint.totalCurrentValuePln)) * 100
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

  return (
    <div className="page-stack">
      <section className="dashboard-stat-grid">
        <article className="panel metric-card">
          <span className="metric-label">Total value</span>
          <strong>{overview ? formatCurrencyPln(overview.totalCurrentValuePln) : '...'}</strong>
          <p>
            {overview
              ? `${overview.accountCount} accounts · ${overview.activeHoldingCount} active holdings`
              : 'Loading portfolio summary...'}
          </p>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Daily change</span>
          <strong className={gainClassName(dailyChange)}>
            {dailyChange != null ? formatSignedCurrencyPln(dailyChange) : '...'}
          </strong>
          <p>
            {dailyChangePct != null
              ? `${formatPercent(dailyChangePct, { signed: true })} vs previous valuation day`
              : 'Waiting for enough history points...'}
          </p>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Valuation health</span>
          <strong>{overview ? `${overview.valuedHoldingCount}/${overview.activeHoldingCount}` : '...'}</strong>
          <p>{overview ? `${openIssues} open issues` : 'Loading valuation state...'}</p>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Backups</span>
          <strong>{backupsQuery.data ? `${backupsQuery.data.backups.length}` : '...'}</strong>
          <p>{lastBackup ? `Latest ${formatDateTime(lastBackup.createdAt)}` : 'No server snapshot yet'}</p>
        </article>
      </section>

      <AllocationBar
        bondWeightPct={bondWeightPct}
        cashWeightPct={cashWeightPct}
        equityWeightPct={equityWeightPct}
      />

      <section className="detail-grid">
        <article className="panel stack-card">
          <div className="section-header">
            <p className="eyebrow">Positioning</p>
            <h3>Allocation snapshot</h3>
            <p>Current mix, capital at work and unresolved valuation gaps.</p>
          </div>

          <dl className="stack-list">
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
            <div>
              <dt>Valuation state</dt>
              <dd>{overview ? `${overview.valuationState} · ${openIssues} open issues` : 'Loading...'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel capabilities-card">
          <div className="section-header">
            <p className="eyebrow">Actions</p>
            <h3>Workflow shortcuts</h3>
            <p>Jump directly into the parts of the product you are most likely to use next.</p>
          </div>

          <div className="shortcut-grid">
            {shortcuts.map((shortcut) => (
              <Link key={shortcut.to} className="shortcut-card" to={shortcut.to}>
                <strong>{shortcut.label}</strong>
                <p>{shortcut.description}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel stack-card">
          <div className="section-header">
            <p className="eyebrow">Portfolio state</p>
            <h3>Capital and gain</h3>
            <p>Book basis, net contributions and the latest valuation move.</p>
          </div>

          <dl className="stack-list">
            <div>
              <dt>Unrealized P/L</dt>
              <dd className={overview ? gainClassName(Number(overview.totalUnrealizedGainPln)) : undefined}>
                {overview ? formatSignedCurrencyPln(overview.totalUnrealizedGainPln) : 'Loading...'}
              </dd>
            </div>
            <div>
              <dt>Net contributions</dt>
              <dd>{overview ? formatCurrencyPln(overview.netContributionsPln) : 'Loading...'}</dd>
            </div>
            <div>
              <dt>Invested current value</dt>
              <dd>{overview ? formatCurrencyPln(overview.investedCurrentValuePln) : 'Loading...'}</dd>
            </div>
            <div>
              <dt>Daily change</dt>
              <dd className={gainClassName(dailyChange)}>
                {dailyChange != null ? formatSignedCurrencyPln(dailyChange) : 'Waiting for enough history...'}
              </dd>
            </div>
          </dl>
        </article>

        <article className="panel stack-card">
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
                  {event.entityId && <p className="audit-event-entity">{event.entityId}</p>}
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <PortfolioAllocationSection />
    </div>
  )
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
