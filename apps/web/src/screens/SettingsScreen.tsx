import type { ReactNode } from 'react'
import { AccountsSection } from '../components/AccountsSection'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { MobileAppSection } from '../components/MobileAppSection'
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
  { id: 'health', label: { en: 'Health', pl: 'Stan systemu' } },
  { id: 'data-quality', label: { en: 'Data quality', pl: 'Jakość danych' } },
  { id: 'setup', label: { en: 'Setup', pl: 'Konfiguracja' } },
  { id: 'targets', label: { en: 'Targets', pl: 'Cele' } },
  { id: 'benchmarks', label: { en: 'Benchmarks', pl: 'Benchmarki' } },
  { id: 'transfer', label: { en: 'Transfer', pl: 'Transfer' } },
  { id: 'backups', label: { en: 'Backups', pl: 'Kopie' } },
  { id: 'cache', label: { en: 'Cache', pl: 'Cache' } },
  { id: 'audit', label: { en: 'Audit', pl: 'Audyt' } },
  { id: 'mobile-app', label: { en: 'Mobile app', pl: 'Aplikacja mobilna' } },
] as const

const SETTINGS_GROUPS = [
  {
    id: 'portfolio',
    eyebrow: { en: 'Portfolio', pl: 'Portfolio' },
    title: { en: 'Setup and portfolio policy', pl: 'Konfiguracja i polityka portfela' },
    description: {
      en: 'Accounts, instruments, target allocation and benchmark policy.',
      pl: 'Konta, instrumenty, alokacja docelowa i polityka benchmarków.',
    },
    sectionIds: ['setup', 'targets', 'benchmarks'] as const,
  },
  {
    id: 'operations',
    eyebrow: { en: 'Operations', pl: 'Operacje' },
    title: { en: 'Transfer and server workflows', pl: 'Transfer i workflowy serwerowe' },
    description: {
      en: 'State transfer, backups and cached read models.',
      pl: 'Transfer stanu, backupy i cache read modeli.',
    },
    sectionIds: ['transfer', 'backups', 'cache'] as const,
  },
  {
    id: 'diagnostics',
    eyebrow: { en: 'Diagnostics', pl: 'Diagnostyka' },
    title: { en: 'System health and data trust', pl: 'Stan systemu i zaufanie do danych' },
    description: {
      en: 'Runtime readiness, data quality and operational audit.',
      pl: 'Gotowość runtime, jakość danych i audyt operacyjny.',
    },
    sectionIds: ['health', 'data-quality', 'audit'] as const,
  },
  {
    id: 'companion',
    eyebrow: { en: 'Companion', pl: 'Aplikacja' },
    title: { en: 'Install and access', pl: 'Instalacja i dostęp' },
    description: {
      en: 'Mobile install guidance and access ergonomics.',
      pl: 'Wskazówki instalacji mobilnej i ergonomia dostępu.',
    },
    sectionIds: ['mobile-app'] as const,
  },
] as const

export function SettingsScreen() {
  const { isPolish } = useI18n()

  return (
    <>
      <PageHeader title={isPolish ? 'Ustawienia' : 'Settings'} />

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 xl:hidden">
        {SETTINGS_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            {isPolish ? section.label.pl : section.label.en}
          </a>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[16rem,minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <Card className="sticky top-6">
            <nav className="space-y-6" aria-label={isPolish ? 'Nawigacja ustawień' : 'Settings navigation'}>
              {SETTINGS_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {isPolish ? group.eyebrow.pl : group.eyebrow.en}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {group.sectionIds.map((sectionId) => {
                      const section = SETTINGS_SECTIONS.find((candidate) => candidate.id === sectionId)
                      if (!section) {
                        return null
                      }
                      return (
                        <a
                          key={section.id}
                          href={`#${section.id}`}
                          className="block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-100"
                        >
                          {isPolish ? section.label.pl : section.label.en}
                        </a>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </Card>
        </aside>

        <div className="space-y-12">
          <SettingsGroup
            eyebrow={isPolish ? SETTINGS_GROUPS[0].eyebrow.pl : SETTINGS_GROUPS[0].eyebrow.en}
            title={isPolish ? SETTINGS_GROUPS[0].title.pl : SETTINGS_GROUPS[0].title.en}
            description={isPolish ? SETTINGS_GROUPS[0].description.pl : SETTINGS_GROUPS[0].description.en}
          >
            <section id="setup" className="scroll-mt-24 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <AccountsSection />
              <InstrumentsSection />
            </section>

            <section id="targets" className="scroll-mt-24">
              <PortfolioTargetsSection />
            </section>

            <section id="benchmarks" className="scroll-mt-24">
              <PortfolioBenchmarkSettingsSection />
            </section>
          </SettingsGroup>

          <SettingsGroup
            eyebrow={isPolish ? SETTINGS_GROUPS[1].eyebrow.pl : SETTINGS_GROUPS[1].eyebrow.en}
            title={isPolish ? SETTINGS_GROUPS[1].title.pl : SETTINGS_GROUPS[1].title.en}
            description={isPolish ? SETTINGS_GROUPS[1].description.pl : SETTINGS_GROUPS[1].description.en}
          >
            <section id="transfer" className="scroll-mt-24">
              <PortfolioStateSection />
            </section>

            <div id="backups" className="scroll-mt-24">
              <PortfolioBackupsSection />
            </div>

            <section id="cache" className="scroll-mt-24">
              <ReadModelCacheSection />
            </section>
          </SettingsGroup>

          <SettingsGroup
            eyebrow={isPolish ? SETTINGS_GROUPS[2].eyebrow.pl : SETTINGS_GROUPS[2].eyebrow.en}
            title={isPolish ? SETTINGS_GROUPS[2].title.pl : SETTINGS_GROUPS[2].title.en}
            description={isPolish ? SETTINGS_GROUPS[2].description.pl : SETTINGS_GROUPS[2].description.en}
          >
            <section id="health" className="scroll-mt-24">
              <SystemReadinessSection />
            </section>

            <section id="data-quality" className="scroll-mt-24">
              <PortfolioDataQualitySection />
            </section>

            <Card as="section" id="audit" className="scroll-mt-24">
              <SectionHeader
                eyebrow={isPolish ? 'Audyt' : 'Audit'}
                title={isPolish ? 'Aktywność operacyjna' : 'Operational activity'}
                description={
                  isPolish
                    ? 'Sprawdź ostatnie backupy, restore, importy i inne operacje zmieniające stan poza przestrzenią transakcji.'
                    : 'Inspect recent backups, restores, imports and other state-changing actions outside the transaction workspace.'
                }
              />
              <OperationalAuditPanel />
            </Card>
          </SettingsGroup>

          <SettingsGroup
            eyebrow={isPolish ? SETTINGS_GROUPS[3].eyebrow.pl : SETTINGS_GROUPS[3].eyebrow.en}
            title={isPolish ? SETTINGS_GROUPS[3].title.pl : SETTINGS_GROUPS[3].title.en}
            description={isPolish ? SETTINGS_GROUPS[3].description.pl : SETTINGS_GROUPS[3].description.en}
          >
            <section id="mobile-app" className="scroll-mt-24">
              <MobileAppSection />
            </section>
          </SettingsGroup>
        </div>
      </div>
    </>
  )
}

function SettingsGroup({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-6">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="space-y-8">{children}</div>
    </section>
  )
}
