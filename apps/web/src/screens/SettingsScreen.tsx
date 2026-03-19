import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
import { PageHeader } from '../components/layout'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { SystemReadinessSection } from '../components/SystemReadinessSection'
import { Card, SectionHeader } from '../components/ui'

const SETTINGS_SECTIONS = [
  { id: 'health', label: 'Health' },
  { id: 'setup', label: 'Setup' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'audit', label: 'Audit' },
  { id: 'backups', label: 'Backups' },
  { id: 'cache', label: 'Cache' },
] as const

export function SettingsScreen() {
  return (
    <>
      <PageHeader title="Settings">
        <div className="hidden flex-wrap items-center gap-2 xl:flex">
          {SETTINGS_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              {section.label}
            </a>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-8">
        <section id="health">
          <SystemReadinessSection />
        </section>

        <section id="setup" className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <AccountsSection />
          <InstrumentsSection />
        </section>

        <section id="transfer">
          <PortfolioStateSection />
        </section>

        <Card as="section" id="audit">
          <SectionHeader
            eyebrow="Audit"
            title="Operational activity"
            description="Inspect recent backups, restores, imports and other state-changing actions outside the transaction workspace."
          />
          <OperationalAuditPanel />
        </Card>

        <div id="backups">
          <PortfolioBackupsSection />
        </div>

        <section id="cache">
          <ReadModelCacheSection />
        </section>
      </div>
    </>
  )
}
