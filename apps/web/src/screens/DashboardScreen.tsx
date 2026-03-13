import { Link } from 'react-router-dom'
import { PortfolioHistorySection } from '../components/PortfolioHistorySection'
import { PortfolioOverviewSection } from '../components/PortfolioOverviewSection'
import { PortfolioReturnsSection } from '../components/PortfolioReturnsSection'
import { useAppMeta } from '../hooks/use-app-meta'

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

      <section className="summary-grid">
        <article className="panel metric-card">
          <span className="metric-label">API stage</span>
          <strong>{data ? formatStage(data.stage) : '...'}</strong>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">Version</span>
          <strong>{data?.version ?? '...'}</strong>
        </article>

        <article className="panel metric-card">
          <span className="metric-label">System state</span>
          <strong>{isError ? 'Degraded' : isLoading ? 'Loading' : 'Healthy'}</strong>
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

      <PortfolioOverviewSection />
      <PortfolioHistorySection />
      <PortfolioReturnsSection />
    </div>
  )
}
