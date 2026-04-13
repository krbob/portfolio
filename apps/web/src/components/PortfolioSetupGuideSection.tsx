import { Link } from 'react-router-dom'
import { usePortfolioSetupGuide, type GuideAction, type GuideStatus } from '../hooks/use-portfolio-setup-guide'
import { t } from '../lib/messages'
import { badge, badgeVariants } from '../lib/styles'
import { Card, SectionHeader } from './ui'

export function PortfolioSetupGuideSection({
  showHeader = true,
  alwaysRender = false,
}: {
  showHeader?: boolean
  alwaysRender?: boolean
}) {
  const { items, doneCount, attentionCount } = usePortfolioSetupGuide()

  if (!alwaysRender && attentionCount === 0) {
    return null
  }

  return (
    <Card as="section">
      {showHeader ? (
        <SectionHeader
          eyebrow={t('setup.eyebrow')}
          title={t('setup.title')}
          description={t('setup.description')}
        />
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        <span className={`${badge} ${badgeVariants.success}`}>
          {t('setup.done')} {doneCount}
        </span>
        <span className={`${badge} ${attentionCount > 0 ? badgeVariants.warning : badgeVariants.default}`}>
          {t('setup.needsAttention')} {attentionCount}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
              </div>
              <span className={`${badge} ${guideBadgeVariant(item.status)}`}>
                {guideStatusLabel(item.status)}
              </span>
            </div>

            {item.action ? (
              <div className="mt-4">
                <GuideActionLink action={item.action} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Card>
  )
}

function GuideActionLink({ action }: { action: GuideAction }) {
  const className = 'inline-flex text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100'

  if (action.kind === 'route') {
    return (
      <Link className={className} to={action.to}>
        {action.label}
      </Link>
    )
  }

  return (
    <a className={className} href={action.to}>
      {action.label}
    </a>
  )
}

function guideBadgeVariant(status: GuideStatus) {
  switch (status) {
    case 'done':
      return badgeVariants.success
    case 'action':
      return badgeVariants.info
    case 'warning':
      return badgeVariants.warning
    case 'info':
      return badgeVariants.default
  }
}

function guideStatusLabel(status: GuideStatus) {
  switch (status) {
    case 'done':
      return t('setup.statusDone')
    case 'action':
      return t('setup.statusTodo')
    case 'warning':
      return t('setup.statusAttention')
    case 'info':
      return t('setup.statusChecking')
  }
}
