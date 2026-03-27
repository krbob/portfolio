import { StatePanel } from './StatePanel'
import { t } from '../../lib/messages'

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
      icon={
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.949 3.374H4.646c-1.732 0-2.815-1.874-1.949-3.374L10.051 3.37c.866-1.5 3.032-1.5 3.898 0l7.354 12.756zM12 16.5h.008v.008H12V16.5z"
          />
        </svg>
      }
      action={onRetry ? { label: retryLabel ?? t('common.retry'), onClick: onRetry } : undefined}
      className={className}
    />
  )
}
