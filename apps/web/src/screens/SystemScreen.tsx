import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { MarketDataSnapshotsSection } from '../components/MarketDataSnapshotsSection'
import { MobileAppSection } from '../components/MobileAppSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
import { PortfolioDataQualitySection } from '../components/PortfolioDataQualitySection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { SystemReadinessSection } from '../components/SystemReadinessSection'
import { Card, SectionHeader, TabBar } from '../components/ui'
import { t } from '../lib/messages'
import { appRoutes } from '../lib/routes'

type SystemTab = 'diagnostics' | 'market-data' | 'audit' | 'app'

function resolveTab(pathname: string): SystemTab {
  return whenPathname(pathname)
}

export function SystemScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = resolveTab(location.pathname)

  function handleTabChange(tab: SystemTab) {
    const targetRoute = {
      diagnostics: appRoutes.system.diagnostics,
      'market-data': appRoutes.system.marketData,
      audit: appRoutes.system.audit,
      app: appRoutes.system.app,
    }[tab]
    navigate(targetRoute, { replace: true })
  }

  return (
    <>
      <PageHeader title={t('system.title')} />
      <TabBar
        value={activeTab}
        onChange={handleTabChange}
        tabs={[
          { value: 'diagnostics' as SystemTab, label: t('system.tabDiagnostics') },
          { value: 'market-data' as SystemTab, label: t('system.tabMarketData') },
          { value: 'audit' as SystemTab, label: t('system.tabAudit') },
          { value: 'app' as SystemTab, label: t('system.tabApp') },
        ]}
      />
      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'diagnostics' && <DiagnosticsContent />}
        {activeTab === 'market-data' && <MarketDataContent />}
        {activeTab === 'audit' && <AuditContent />}
        {activeTab === 'app' && <MobileAppSection />}
      </div>
    </>
  )
}

function whenPathname(pathname: string): SystemTab {
  switch (pathname) {
    case appRoutes.system.marketData:
      return 'market-data'
    case appRoutes.system.audit:
      return 'audit'
    case appRoutes.system.app:
      return 'app'
    default:
      return 'diagnostics'
  }
}

function DiagnosticsContent() {
  return (
    <div className="space-y-8">
      <SystemReadinessSection />
      <PortfolioDataQualitySection />
    </div>
  )
}

function MarketDataContent() {
  return (
    <div className="space-y-8">
      <MarketDataSnapshotsSection />
      <ReadModelCacheSection />
    </div>
  )
}

function AuditContent() {
  return (
    <Card>
      <SectionHeader
        eyebrow={t('settings.auditEyebrow')}
        title={t('settings.auditTitle')}
        description={t('settings.auditDescription')}
      />
      <OperationalAuditPanel />
    </Card>
  )
}
