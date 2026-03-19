import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageIntro } from '../components/PageIntro'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'

export function SettingsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Operations"
        title="Settings"
        description="Keep reference data, state transfer, backups and cache diagnostics in one operational workspace."
      />

      <section className="workspace-grid">
        <AccountsSection />
        <InstrumentsSection />
      </section>

      <PortfolioStateSection />

      <div id="backups">
        <PortfolioBackupsSection />
      </div>

      <ReadModelCacheSection />
    </div>
  )
}
