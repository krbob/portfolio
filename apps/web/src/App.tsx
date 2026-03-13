import { AppShell } from './components/AppShell'
import { AccountsSection } from './components/AccountsSection'
import { InstrumentsSection } from './components/InstrumentsSection'
import { HoldingsSection } from './components/HoldingsSection'
import { PortfolioHistorySection } from './components/PortfolioHistorySection'
import { PortfolioOverviewSection } from './components/PortfolioOverviewSection'
import { TransactionsSection } from './components/TransactionsSection'
import { useAppMeta } from './hooks/use-app-meta'

function formatStage(stage: string) {
  return stage.toUpperCase()
}

export function App() {
  const { data, isLoading, isError } = useAppMeta()

  return (
    <AppShell>
      <section className="hero-card">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Dashboard shell</p>
            <h2 className="hero-title">A calm control panel for a long-term portfolio.</h2>
          </div>

          <div className="status-pill">
            {isLoading && 'Connecting API'}
            {isError && 'API unavailable'}
            {data && `${data.name} ${formatStage(data.stage)}`}
          </div>
        </div>

        <p className="hero-copy">
          This first slice wires the web app to the API and defines the shape of the product: web-first,
          transaction-based, and rebuildable from raw portfolio events plus market data.
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
          <h3>Planned capabilities</h3>
          <ul>
            {(data?.capabilities ?? []).map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
            {!data && <li>Loading capabilities...</li>}
          </ul>
        </article>
      </section>

      <PortfolioOverviewSection />
      <PortfolioHistorySection />
      <HoldingsSection />

      <section className="workspace-grid">
        <AccountsSection />
        <InstrumentsSection />
      </section>

      <TransactionsSection />
    </AppShell>
  )
}
