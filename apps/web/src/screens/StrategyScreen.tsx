import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { PortfolioBenchmarkSettingsSection } from '../components/PortfolioBenchmarkSettingsSection'
import { PortfolioTargetsSection } from '../components/PortfolioTargetsSection'
import { StaleMarketDataAlert } from '../components/StaleMarketDataAlert'
import { TabBar } from '../components/ui'
import { useStaleMarketDataAlert } from '../hooks/use-stale-market-data-alert'
import { t } from '../lib/messages'
import { InstrumentsManagement } from './InstrumentsScreen'

type StrategyTab = 'instruments' | 'targets' | 'benchmarks'

const VALID_TABS: StrategyTab[] = ['instruments', 'targets', 'benchmarks']

function resolveTab(raw: string | null): StrategyTab {
  return VALID_TABS.includes(raw as StrategyTab) ? (raw as StrategyTab) : 'instruments'
}

export function StrategyScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = resolveTab(searchParams.get('tab'))
  const staleAlert = useStaleMarketDataAlert()

  function handleTabChange(tab: StrategyTab) {
    if (tab === 'instruments') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
  }

  return (
    <>
      <PageHeader title={t('strategy.title')} />
      <StaleMarketDataAlert alert={staleAlert.alert} />
      <TabBar
        value={activeTab}
        onChange={handleTabChange}
        tabs={[
          { value: 'instruments' as StrategyTab, label: t('strategy.tabInstruments') },
          { value: 'targets' as StrategyTab, label: t('strategy.tabTargets') },
          { value: 'benchmarks' as StrategyTab, label: t('strategy.tabBenchmarks') },
        ]}
      />
      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'instruments' && <InstrumentsManagement />}
        {activeTab === 'targets' && <PortfolioTargetsSection />}
        {activeTab === 'benchmarks' && <PortfolioBenchmarkSettingsSection />}
      </div>
    </>
  )
}
