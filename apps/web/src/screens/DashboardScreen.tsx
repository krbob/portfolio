import { Link } from 'react-router-dom'
import { AllocationBar } from '../components/AllocationBar'
import { PortfolioHistorySection } from '../components/PortfolioHistorySection'
import { PortfolioOverviewSection } from '../components/PortfolioOverviewSection'
import { PortfolioReturnsSection } from '../components/PortfolioReturnsSection'
import { useAppMeta } from '../hooks/use-app-meta'
import { usePortfolioDailyHistory, usePortfolioOverview } from '../hooks/use-read-model'
import { usePortfolioBackups } from '../hooks/use-write-model'

function formatStage(stage: string) {
  return stage.toUpperCase()
}

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
    to: '/backups',
    label: 'Check backups',
    description: 'Inspect server snapshots before running restore or import operations.',
  },
]

export function DashboardScreen() {
  const { data, isLoading, isError } = useAppMeta()
  const overviewQuery = usePortfolioOverview()
  const historyQuery = usePortfolioDailyHistory()
  const backupsQuery = usePortfolioBackups()
  const overview = overviewQuery.data
  const latestHistoryPoint = historyQuery.data?.points.at(-1)
  const previousHistoryPoint = historyQuery.data?.points.at(-2)
  const dailyChange = latestHistoryPoint && previousHistoryPoint
    ? Number(latestHistoryPoint.totalCurrentValuePln) - Number(previousHistoryPoint.totalCurrentValuePln)
    : null
  const dailyChangePct = dailyChange != null && previousHistoryPoint && Number(previousHistoryPoint.totalCurrentValuePln) !== 0
    ? (dailyChange / Number(previousHistoryPoint.totalCurrentValuePln)) * 100
    : null
  const totalCurrentValue = overview ? Number(overview.totalCurrentValuePln) : 0
  const equityWeightPct = overview && totalCurrentValue > 0
    ? (Number(overview.equityCurrentValuePln) / totalCurrentValue) * 100
    : 0
  const bondWeightPct = overview && totalCurrentValue > 0
    ? (Number(overview.bondCurrentValuePln) / totalCurrentValue) * 100
    : 0
  const cashWeightPct = overview && totalCurrentValue > 0
    ? (Number(overview.cashCurrentValuePln) / totalCurrentValue) * 100
    : 0
  const lastBackup = backupsQuery.data?.backups[0] ?? null

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2 className="hero-title">A calm control panel for a long-term portfolio.</h2>
          </div>

          <div className="status-pill">
            {isLoading && 'Connecting API'}
            {isError && 'API unavailable'}
            {data && `${data.name} ${formatStage(data.stage)}`}
          </div>
        </div>

        <p className="hero-copy">
          Transactions remain the source of truth. Current value, returns, history and backup workflows
          are derived from rebuildable portfolio state plus market data integrations.
        </p>
      </section>

      <section className="dashboard-stat-grid">
        <article className="panel metric-card">
          <span className="metric-label">Total value</span>
          <strong>{overview ? formatCurrency(overview.totalCurrentValuePln) : '...'}</strong>
          <p>{overview ? `${overview.accountCount} accounts · ${overview.activeHoldingCount} active holdings` : 'Loading portfolio summary...'}</p>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Daily change</span>
          <strong className={gainClassName(dailyChange)}>{dailyChange != null ? formatSignedCurrency(dailyChange) : '...'}</strong>
          <p>{dailyChangePct != null ? `${formatSignedPercent(dailyChangePct)} vs previous valuation day` : 'Waiting for enough history points...'}</p>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Valuation health</span>
          <strong>
            {overview ? `${overview.valuedHoldingCount}/${overview.activeHoldingCount}` : '...'}
          </strong>
          <p>
            {overview
              ? `${overview.valuationIssueCount + overview.missingFxTransactions + overview.unsupportedCorrectionTransactions} open issues`
              : 'Loading valuation state...'}
          </p>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Backups</span>
          <strong>{backupsQuery.data ? `${backupsQuery.data.backups.length}` : '...'}</strong>
          <p>{lastBackup ? `Latest ${formatTimestamp(lastBackup.createdAt)}` : 'No server snapshot yet'}</p>
        </article>
      </section>

      <AllocationBar
        bondWeightPct={bondWeightPct}
        cashWeightPct={cashWeightPct}
        equityWeightPct={equityWeightPct}
      />

      <section className="detail-grid">
        <article className="panel stack-card">
          <h3>Valuation and operations</h3>
          <dl className="stack-list">
            <div>
              <dt>Unrealized P/L</dt>
              <dd className={overview ? gainClassName(Number(overview.totalUnrealizedGainPln)) : undefined}>
                {overview ? formatSignedCurrency(Number(overview.totalUnrealizedGainPln)) : 'Loading...'}
              </dd>
            </div>
            <div>
              <dt>Net contributions</dt>
              <dd>{overview ? formatCurrency(overview.netContributionsPln) : 'Loading...'}</dd>
            </div>
            <div>
              <dt>System</dt>
              <dd>{isError ? 'Degraded' : isLoading ? 'Loading' : 'Healthy'} · {data ? formatStage(data.stage) : '...'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel capabilities-card">
          <h3>Workflow shortcuts</h3>
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
          <h3>Chosen stack</h3>
          <dl className="stack-list">
            <div>
              <dt>Web</dt>
              <dd>{data?.stack.web ?? 'Loading...'}</dd>
            </div>
            <div>
              <dt>API</dt>
              <dd>{data?.stack.api ?? 'Loading...'}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{data?.stack.database ?? 'Loading...'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel stack-card">
          <h3>Recent operational events</h3>
          <dl className="stack-list">
            <div>
              <dt>Last valuation day</dt>
              <dd>{latestHistoryPoint?.date ?? 'No history yet'}</dd>
            </div>
            <div>
              <dt>Last backup success</dt>
              <dd>{backupsQuery.data?.lastSuccessAt ? formatTimestamp(backupsQuery.data.lastSuccessAt) : 'No successful backup yet'}</dd>
            </div>
            <div>
              <dt>Backup scheduler</dt>
              <dd>{backupsQuery.data?.schedulerEnabled ? 'Enabled' : 'Manual only'}</dd>
            </div>
          </dl>
        </article>
      </section>

      <PortfolioOverviewSection />
      <PortfolioReturnsSection />
      <PortfolioHistorySection />
    </div>
  )
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatSignedCurrency(value: number) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(value)
  return value > 0 ? `+${formatted}` : formatted
}

function formatSignedPercent(value: number) {
  const formatted = `${Math.abs(value).toFixed(2)}%`
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted
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

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
