import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { PortfolioBackupsSection } from '../components/PortfolioBackupsSection'
import { PortfolioStateSection } from '../components/PortfolioStateSection'
import { TransactionImportSection } from '../components/TransactionImportSection'
import { TabBar } from '../components/ui'
import { t } from '../lib/messages'

type DataTab = 'import' | 'transfer' | 'backups'

const VALID_TABS: DataTab[] = ['import', 'transfer', 'backups']

function resolveTab(raw: string | null): DataTab {
  return VALID_TABS.includes(raw as DataTab) ? (raw as DataTab) : 'import'
}

export function DataScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = resolveTab(searchParams.get('tab'))

  function handleTabChange(tab: DataTab) {
    if (tab === 'import') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
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
