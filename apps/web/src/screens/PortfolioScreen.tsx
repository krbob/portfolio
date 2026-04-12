import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { TabBar } from '../components/ui'
import { t } from '../lib/messages'
import { appRoutes } from '../lib/routes'
import { HoldingsContent } from './HoldingsScreen'
import { AccountsContent } from './AccountsScreen'

type PortfolioTab = 'holdings' | 'accounts'

export function PortfolioScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab: PortfolioTab = location.pathname === appRoutes.portfolio.accounts ? 'accounts' : 'holdings'

  function handleTabChange(tab: PortfolioTab) {
    navigate(tab === 'accounts' ? appRoutes.portfolio.accounts : appRoutes.portfolio.holdings, { replace: true })
  }

  return (
    <>
      <PageHeader title={t('portfolio.title')} />
      <TabBar
        value={activeTab}
        onChange={handleTabChange}
        tabs={[
          { value: 'holdings' as PortfolioTab, label: t('portfolio.holdingsTab') },
          { value: 'accounts' as PortfolioTab, label: t('portfolio.accountsTab') },
        ]}
      />
      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'accounts' ? <AccountsContent /> : <HoldingsContent />}
      </div>
    </>
  )
}
