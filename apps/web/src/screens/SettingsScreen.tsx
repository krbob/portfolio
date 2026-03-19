import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
import { PageHeader } from '../components/layout'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { SectionCard } from '../components/SectionCard'
import { SystemReadinessSection } from '../components/SystemReadinessSection'

export function SettingsScreen() {
  return (
    <>
      <PageHeader title="Settings" />

      <div className="space-y-8">
        <SystemReadinessSection />

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
    </>
  )
}
