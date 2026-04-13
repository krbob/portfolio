import { Link } from 'react-router-dom'
import { usePortfolioSetupGuide } from '../hooks/use-portfolio-setup-guide'
import { formatMessage, t } from '../lib/messages'
import { appRoutes } from '../lib/routes'
import { btnSecondary, card } from '../lib/styles'

export function DashboardSetupBanner() {
  const { attentionCount } = usePortfolioSetupGuide()

  if (attentionCount === 0) {
    return null
  }

  return (
    <section className={`${card} border-blue-500/30 bg-blue-500/5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-300">
            {t('setup.bannerEyebrow')}
          </p>
          <h2 className="text-base font-semibold text-zinc-100">
            {t('setup.bannerTitle')}
          </h2>
          <p className="text-sm text-zinc-400">
            {formatMessage(t('setup.bannerDescription'), { count: attentionCount })}
          </p>
        </div>
        <Link className={btnSecondary} to={appRoutes.setup}>
          {t('setup.openChecklist')}
        </Link>
      </div>
    </section>
  )
}
