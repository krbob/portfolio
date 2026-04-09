import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { MarketDataSnapshotsSection } from '../components/MarketDataSnapshotsSection'
import { MobileAppSection } from '../components/MobileAppSection'
import { OperationalAuditPanel } from '../components/OperationalAuditPanel'
import { PortfolioDataQualitySection } from '../components/PortfolioDataQualitySection'
import { ReadModelCacheSection } from '../components/ReadModelCacheSection'
import { SystemReadinessSection } from '../components/SystemReadinessSection'
import { Card, SectionHeader, TabBar } from '../components/ui'
import { t } from '../lib/messages'

type SystemTab = 'diagnostics' | 'market-data' | 'audit' | 'app'

const VALID_TABS: SystemTab[] = ['diagnostics', 'market-data', 'audit', 'app']

function resolveTab(raw: string | null): SystemTab {
  return VALID_TABS.includes(raw as SystemTab) ? (raw as SystemTab) : 'diagnostics'
}

export function SystemScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = resolveTab(searchParams.get('tab'))

  function handleTabChange(tab: SystemTab) {
    if (tab === 'diagnostics') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
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
