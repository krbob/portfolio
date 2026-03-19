import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
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
        eyebrow="Audit"
        title="Operational activity"
        description="Inspect recent backups, restores, imports and other state-changing actions outside the transaction workspace."
      >
        <OperationalAuditPanel />
      </SectionCard>

      <div id="backups">
        <PortfolioBackupsSection />
      </div>

      <ReadModelCacheSection />
    </div>
  )
}
