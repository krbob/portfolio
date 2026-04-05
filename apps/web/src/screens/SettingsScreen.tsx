import clsx from 'clsx'
import { type ReactNode } from 'react'
import { MobileAppSection } from '../components/MobileAppSection'
import { MarketDataSnapshotsSection } from '../components/MarketDataSnapshotsSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
import { PageHeader } from '../components/layout'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioBenchmarkSettingsSection } from '../components/PortfolioBenchmarkSettingsSection'
import { PortfolioDataQualitySection } from '../components/PortfolioDataQualitySection'
import { PortfolioSetupGuideSection } from '../components/PortfolioSetupGuideSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { PortfolioTargetsSection } from '../components/PortfolioTargetsSection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { StaleMarketDataAlert } from '../components/StaleMarketDataAlert'
import { SystemReadinessSection } from '../components/SystemReadinessSection'
import { TransactionImportSection } from '../components/TransactionImportSection'
import { Card, FadeIn, SectionHeader } from '../components/ui'
import { useActiveSectionId } from '../hooks/use-active-section'
import { useStaleMarketDataAlert } from '../hooks/use-stale-market-data-alert'
import { t } from '../lib/messages'
import { InstrumentsManagement } from './InstrumentsScreen'

const SETTINGS_SECTIONS = [
  { id: 'health', labelKey: 'settings.navHealth' },
  { id: 'data-quality', labelKey: 'settings.navDataQuality' },
  { id: 'instruments', labelKey: 'settings.navInstruments' },
  { id: 'targets', labelKey: 'settings.navTargets' },
  { id: 'benchmarks', labelKey: 'settings.navBenchmarks' },
  { id: 'csv-import', labelKey: 'settings.navCsvImport' },
  { id: 'transfer', labelKey: 'settings.navTransfer' },
  { id: 'backups', labelKey: 'settings.navBackups' },
  { id: 'market-data', labelKey: 'settings.navMarketData' },
  { id: 'cache', labelKey: 'settings.navCache' },
  { id: 'audit', labelKey: 'settings.navAudit' },
  { id: 'mobile-app', labelKey: 'settings.navMobileApp' },
] as const

const SECTION_IDS = SETTINGS_SECTIONS.map((s) => s.id)

export function SettingsScreen() {
  const staleAlert = useStaleMarketDataAlert()
  const activeSectionId = useActiveSectionId(SECTION_IDS)

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <StaleMarketDataAlert alert={staleAlert.alert} />

      <nav
        className="sticky top-0 z-20 -mx-1 mb-6 flex gap-1.5 overflow-x-auto bg-zinc-950/90 px-1 py-2 backdrop-blur-sm"
        aria-label={t('settings.navLabel')}
      >
        {SETTINGS_SECTIONS.map((section) => {
          const isActive = activeSectionId === section.id
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={clsx(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
              )}
            >
              {t(section.labelKey)}
            </a>
          )
        })}
      </nav>

      <FadeIn>
      <div className="space-y-12">
        <section id="setup-guide" className="scroll-mt-16">
          <PortfolioSetupGuideSection />
        </section>

        <SettingsGroup
          eyebrow={t('settings.portfolioEyebrow')}
          title={t('settings.portfolioTitle')}
          description={t('settings.portfolioDescription')}
        >
          <section id="instruments" className="scroll-mt-16">
            <InstrumentsManagement />
          </section>

          <section id="targets" className="scroll-mt-16">
            <PortfolioTargetsSection />
          </section>

          <section id="benchmarks" className="scroll-mt-16">
            <PortfolioBenchmarkSettingsSection />
          </section>
        </SettingsGroup>

        <SettingsGroup
          eyebrow={t('settings.operationsEyebrow')}
          title={t('settings.operationsTitle')}
          description={t('settings.operationsDescription')}
        >
          <section id="csv-import" className="scroll-mt-16">
            <TransactionImportSection />
          </section>

          <section id="transfer" className="scroll-mt-16">
            <PortfolioStateSection />
          </section>

          <section id="backups" className="scroll-mt-16">
            <PortfolioBackupsSection />
          </section>

          <section id="market-data" className="scroll-mt-16">
            <MarketDataSnapshotsSection />
          </section>

          <section id="cache" className="scroll-mt-16">
            <ReadModelCacheSection />
          </section>
        </SettingsGroup>

        <SettingsGroup
          eyebrow={t('settings.diagnosticsEyebrow')}
          title={t('settings.diagnosticsTitle')}
          description={t('settings.diagnosticsDescription')}
        >
          <section id="health" className="scroll-mt-16">
            <SystemReadinessSection />
          </section>

          <section id="data-quality" className="scroll-mt-16">
            <PortfolioDataQualitySection />
          </section>

          <Card as="section" id="audit" className="scroll-mt-16">
            <SectionHeader
              eyebrow={t('settings.auditEyebrow')}
              title={t('settings.auditTitle')}
              description={t('settings.auditDescription')}
            />
            <OperationalAuditPanel />
          </Card>
        </SettingsGroup>

        <SettingsGroup
          eyebrow={t('settings.companionEyebrow')}
          title={t('settings.companionTitle')}
          description={t('settings.companionDescription')}
        >
          <section id="mobile-app" className="scroll-mt-16">
            <MobileAppSection />
          </section>
        </SettingsGroup>
      </div>
      </FadeIn>
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
