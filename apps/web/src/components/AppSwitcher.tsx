import clsx from 'clsx'
import { useAppMeta } from '../hooks/use-app-meta'
import { appLinkPreferencesForLocale, buildStockAnalystHref, type AppLinkPreferences } from '../lib/app-links'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'
import { IconPerformance } from './ui/icons'

interface AppSwitcherProps {
  compact?: boolean
  onNavigate?: () => void
}

interface AppSwitcherLinkProps extends AppSwitcherProps {
  configuredUrl: string | null | undefined
  preferences: AppLinkPreferences
  currentOrigin?: string
}

export function AppSwitcher({ compact = false, onNavigate }: AppSwitcherProps) {
  const metaQuery = useAppMeta()
  const { localeTag } = useI18n()

  return (
    <AppSwitcherLink
      configuredUrl={metaQuery.data?.stockAnalystUiUrl}
      preferences={appLinkPreferencesForLocale(localeTag)}
      compact={compact}
      onNavigate={onNavigate}
    />
  )
}

export function AppSwitcherLink({
  configuredUrl,
  preferences,
  compact = false,
  currentOrigin,
  onNavigate,
}: AppSwitcherLinkProps) {
  const href = buildStockAnalystHref(configuredUrl, { preferences, currentOrigin })
  if (!href) return null

  return (
    <a
      href={href}
      onClick={onNavigate}
      aria-label={t('appSwitcher.openStockAnalyst')}
      title={t('appSwitcher.switchToStockAnalyst')}
      className={clsx(
        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-ui-control border border-ui-border-strong bg-ui-surface-raised px-3 text-sm font-medium text-ui-text-secondary transition-colors hover:border-ui-action hover:text-ui-action focus:outline-none focus-visible:border-ui-action focus-visible:ring-2 focus-visible:ring-ui-action/30',
        compact && 'w-10 px-0',
      )}
    >
      <span aria-hidden="true">
        <IconPerformance />
      </span>
      <span className={clsx(compact && 'sr-only')}>{t('appSwitcher.stockAnalyst')}</span>
    </a>
  )
}
