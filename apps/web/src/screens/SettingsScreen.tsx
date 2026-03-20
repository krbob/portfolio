import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
import { PageHeader } from '../components/layout'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioBenchmarkSettingsSection } from '../components/PortfolioBenchmarkSettingsSection'
import { PortfolioDataQualitySection } from '../components/PortfolioDataQualitySection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { PortfolioTargetsSection } from '../components/PortfolioTargetsSection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { SystemReadinessSection } from '../components/SystemReadinessSection'
import { Card, SectionHeader } from '../components/ui'
import { useI18n } from '../lib/i18n'

const SETTINGS_SECTIONS = [
  { id: 'health', label: 'Health' },
  { id: 'data-quality', label: 'Data quality' },
  { id: 'setup', label: 'Setup' },
  { id: 'targets', label: 'Targets' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'audit', label: 'Audit' },
  { id: 'backups', label: 'Backups' },
  { id: 'cache', label: 'Cache' },
] as const

export function SettingsScreen() {
  const { isPolish } = useI18n()

  return (
    <>
      <PageHeader title={isPolish ? 'Ustawienia' : 'Settings'}>
        <div className="hidden flex-wrap items-center gap-2 xl:flex">
          {SETTINGS_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              {isPolish
                ? ({
                    Health: 'Stan systemu',
                    'Data quality': 'Jakość danych',
                    Setup: 'Konfiguracja',
                    Targets: 'Cele',
                    Benchmarks: 'Benchmarki',
                    Transfer: 'Transfer',
                    Audit: 'Audyt',
                    Backups: 'Kopie',
                    Cache: 'Cache',
                  } as Record<string, string>)[section.label]
                : section.label}
            </a>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-8">
        <section id="health">
          <SystemReadinessSection />
        </section>

        <section id="data-quality">
          <PortfolioDataQualitySection />
        </section>

        <section id="setup" className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <AccountsSection />
          <InstrumentsSection />
        </section>

        <section id="targets">
          <PortfolioTargetsSection />
        </section>

        <section id="benchmarks">
          <PortfolioBenchmarkSettingsSection />
        </section>

        <section id="transfer">
          <PortfolioStateSection />
        </section>

        <Card as="section" id="audit">
          <SectionHeader
            eyebrow={isPolish ? 'Audyt' : 'Audit'}
            title={isPolish ? 'Aktywność operacyjna' : 'Operational activity'}
            description={isPolish
              ? 'Sprawdź ostatnie backupy, restore, importy i inne operacje zmieniające stan poza przestrzenią transakcji.'
              : 'Inspect recent backups, restores, imports and other state-changing actions outside the transaction workspace.'}
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
