import { t } from '../../lib/messages'
import { IconWarning } from './icons'
import { StatePanel } from './StatePanel'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  return (
    <StatePanel
      eyebrow={t('ui.unavailable')}
      title={title ?? t('ui.errorTitle')}
      description={description ?? t('ui.errorDescription')}
      tone="error"
      icon={<IconWarning />}
      action={onRetry ? { label: retryLabel ?? t('common.retry'), onClick: onRetry } : undefined}
      className={className}
    />
  )
}
