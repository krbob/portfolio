import { ImportAuditPanel } from '../components/ImportAuditPanel'
import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageIntro } from '../components/PageIntro'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { SectionCard } from '../components/SectionCard'
import { SystemReadinessSection } from '../components/SystemReadinessSection'

export function SettingsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Operations"
        title="Settings"
        description="Keep reference data, state transfer, backups and cache diagnostics in one operational workspace."
      />

      <SystemReadinessSection />

      <section className="workspace-grid">
        <AccountsSection />
        <InstrumentsSection />
      </section>

      <PortfolioStateSection />

      <SectionCard
        eyebrow="Imports"
        title="Import history"
        description="Inspect recent CSV import sessions, source metadata and conflict outcomes outside the transaction workspace."
      >
        <ImportAuditPanel
          title="Recent imports"
          description="Use this operational feed to verify what was imported, from which source, and with what outcome."
        />
      </SectionCard>

      <div id="backups">
        <PortfolioBackupsSection />
      </div>

      <ReadModelCacheSection />
    </div>
  )
}
