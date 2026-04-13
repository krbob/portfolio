import { PageHeader } from '../components/layout'
import { PortfolioSetupGuideSection } from '../components/PortfolioSetupGuideSection'
import { t } from '../lib/messages'

export function SetupGuideScreen() {
  return (
    <>
      <PageHeader title={t('setup.pageTitle')}>
        <span className="text-sm text-zinc-500">
          {t('setup.pageDescription')}
        </span>
      </PageHeader>

      <PortfolioSetupGuideSection showHeader={false} alwaysRender />
    </>
  )
}
