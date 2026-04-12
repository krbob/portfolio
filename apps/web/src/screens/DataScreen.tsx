import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { TransactionImportSection } from '../components/TransactionImportSection'
import { TabBar } from '../components/ui'
import { t } from '../lib/messages'
import { appRoutes } from '../lib/routes'

type DataTab = 'import' | 'transfer' | 'backups'

function resolveTab(pathname: string): DataTab {
  switch (pathname) {
    case appRoutes.data.transfer:
      return 'transfer'
    case appRoutes.data.backups:
      return 'backups'
    default:
      return 'import'
  }
}

export function DataScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = resolveTab(location.pathname)

  function handleTabChange(tab: DataTab) {
    const targetRoute = {
      import: appRoutes.data.import,
      transfer: appRoutes.data.transfer,
      backups: appRoutes.data.backups,
    }[tab]
    navigate(targetRoute, { replace: true })
  }

  return (
    <>
      <PageHeader title={t('dataPage.title')} />
      <TabBar
        value={activeTab}
        onChange={handleTabChange}
        tabs={[
          { value: 'import' as DataTab, label: t('dataPage.tabImport') },
          { value: 'transfer' as DataTab, label: t('dataPage.tabTransfer') },
          { value: 'backups' as DataTab, label: t('dataPage.tabBackups') },
        ]}
      />
      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'import' && <TransactionImportSection />}
        {activeTab === 'transfer' && <PortfolioStateSection />}
        {activeTab === 'backups' && <PortfolioBackupsSection />}
      </div>
    </>
  )
}
