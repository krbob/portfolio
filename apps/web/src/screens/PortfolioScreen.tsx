import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { TabBar } from '../components/ui'
import { t } from '../lib/messages'
import { HoldingsContent } from './HoldingsScreen'
import { AccountsContent } from './AccountsScreen'

type PortfolioTab = 'holdings' | 'accounts'

export function PortfolioScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: PortfolioTab = searchParams.get('tab') === 'accounts' ? 'accounts' : 'holdings'

  function handleTabChange(tab: PortfolioTab) {
    if (tab === 'accounts') {
      setSearchParams({ tab: 'accounts' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
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
      {activeTab === 'accounts' ? <AccountsContent /> : <HoldingsContent />}
    </>
  )
}
