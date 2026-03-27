import type { ReactNode } from 'react'
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
import { Card, SectionHeader } from '../components/ui'
import { useStaleMarketDataAlert } from '../hooks/use-stale-market-data-alert'
import { t } from '../lib/messages'

const SETTINGS_SECTIONS = [
  { id: 'health', labelKey: 'settings.navHealth' },
  { id: 'data-quality', labelKey: 'settings.navDataQuality' },
  { id: 'targets', labelKey: 'settings.navTargets' },
  { id: 'benchmarks', labelKey: 'settings.navBenchmarks' },
  { id: 'transfer', labelKey: 'settings.navTransfer' },
  { id: 'backups', labelKey: 'settings.navBackups' },
  { id: 'market-data', labelKey: 'settings.navMarketData' },
  { id: 'cache', labelKey: 'settings.navCache' },
  { id: 'audit', labelKey: 'settings.navAudit' },
  { id: 'mobile-app', labelKey: 'settings.navMobileApp' },
] as const

export function SettingsScreen() {
  const staleAlert = useStaleMarketDataAlert()

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <StaleMarketDataAlert alert={staleAlert.alert} />

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 xl:hidden">
        {SETTINGS_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            {t(section.labelKey)}
          </a>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[16rem,minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <Card className="sticky top-6">
            <nav className="space-y-6" aria-label={t('settings.navLabel')}>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {t('settings.portfolioEyebrow')}
                </p>
                <div className="mt-3 space-y-1.5">
                  {(['settings.navTargets', 'settings.navBenchmarks'] as const).map((key) => (
                    <a
                      key={key}
                      href={`#${key === 'settings.navTargets' ? 'targets' : 'benchmarks'}`}
                      className="block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-100"
                    >
                      {t(key)}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {t('settings.operationsEyebrow')}
                </p>
                <div className="mt-3 space-y-1.5">
                    {([
                      { key: 'settings.navTransfer', id: 'transfer' },
                      { key: 'settings.navBackups', id: 'backups' },
                      { key: 'settings.navMarketData', id: 'market-data' },
                      { key: 'settings.navCache', id: 'cache' },
                    ] as const).map((item) => (
                    <a
                      key={item.key}
                      href={`#${item.id}`}
                      className="block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-100"
                    >
                      {t(item.key)}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {t('settings.diagnosticsEyebrow')}
                </p>
                <div className="mt-3 space-y-1.5">
                  {([
                    { key: 'settings.navHealth', id: 'health' },
                    { key: 'settings.navDataQuality', id: 'data-quality' },
                    { key: 'settings.navAudit', id: 'audit' },
                  ] as const).map((item) => (
                    <a
                      key={item.key}
                      href={`#${item.id}`}
                      className="block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-100"
                    >
                      {t(item.key)}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {t('settings.companionEyebrow')}
                </p>
                <div className="mt-3 space-y-1.5">
                  <a
                    href="#mobile-app"
                    className="block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-100"
                  >
                    {t('settings.navMobileApp')}
                  </a>
                </div>
              </div>
            </nav>
          </Card>
        </aside>

        <div className="space-y-12">
          <section id="setup-guide" className="scroll-mt-24">
            <PortfolioSetupGuideSection />
          </section>

          <SettingsGroup
            eyebrow={t('settings.portfolioEyebrow')}
            title={t('settings.portfolioTitle')}
            description={t('settings.portfolioDescription')}
          >
            <section id="targets" className="scroll-mt-24">
              <PortfolioTargetsSection />
            </section>

            <section id="benchmarks" className="scroll-mt-24">
              <PortfolioBenchmarkSettingsSection />
            </section>
          </SettingsGroup>

          <SettingsGroup
            eyebrow={t('settings.operationsEyebrow')}
            title={t('settings.operationsTitle')}
            description={t('settings.operationsDescription')}
          >
            <section id="transfer" className="scroll-mt-24">
              <PortfolioStateSection />
            </section>

            <section id="backups" className="scroll-mt-24">
              <PortfolioBackupsSection />
            </section>

            <section id="market-data" className="scroll-mt-24">
              <MarketDataSnapshotsSection />
            </section>

            <section id="cache" className="scroll-mt-24">
              <ReadModelCacheSection />
            </section>
          </SettingsGroup>

          <SettingsGroup
            eyebrow={t('settings.diagnosticsEyebrow')}
            title={t('settings.diagnosticsTitle')}
            description={t('settings.diagnosticsDescription')}
          >
            <section id="health" className="scroll-mt-24">
              <SystemReadinessSection />
            </section>

            <section id="data-quality" className="scroll-mt-24">
              <PortfolioDataQualitySection />
            </section>

            <Card as="section" id="audit" className="scroll-mt-24">
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
