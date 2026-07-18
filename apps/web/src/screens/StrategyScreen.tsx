import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { PortfolioBenchmarkSettingsSection } from '../components/PortfolioBenchmarkSettingsSection'
import { PortfolioTargetsSection } from '../components/PortfolioTargetsSection'
import { PortfolioWithdrawalPlannerSection } from '../components/PortfolioWithdrawalPlannerSection'
import { StaleMarketDataAlert } from '../components/StaleMarketDataAlert'
import { TabBar } from '../components/ui'
import { useStaleMarketDataAlert } from '../hooks/use-stale-market-data-alert'
import { t } from '../lib/messages'
import { appRoutes } from '../lib/routes'
import { InstrumentsManagement } from './InstrumentsScreen'

type StrategyTab = 'instruments' | 'targets' | 'benchmarks' | 'withdrawals'

function resolveTab(pathname: string): StrategyTab {
  switch (pathname) {
    case appRoutes.strategy.targets:
      return 'targets'
    case appRoutes.strategy.benchmarks:
      return 'benchmarks'
    case appRoutes.strategy.withdrawals:
      return 'withdrawals'
    default:
      return 'instruments'
  }
}

export function StrategyScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = resolveTab(location.pathname)
  const staleAlert = useStaleMarketDataAlert()

  function handleTabChange(tab: StrategyTab) {
    const targetRoute = {
      instruments: appRoutes.strategy.instruments,
      targets: appRoutes.strategy.targets,
      benchmarks: appRoutes.strategy.benchmarks,
      withdrawals: appRoutes.strategy.withdrawals,
    }[tab]
    navigate(targetRoute, { replace: true })
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
          { value: 'withdrawals' as StrategyTab, label: t('strategy.tabWithdrawals') },
        ]}
      />
      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'instruments' && <InstrumentsManagement />}
        {activeTab === 'targets' && <PortfolioTargetsSection />}
        {activeTab === 'benchmarks' && <PortfolioBenchmarkSettingsSection />}
        {activeTab === 'withdrawals' && <PortfolioWithdrawalPlannerSection />}
      </div>
    </>
  )
}
