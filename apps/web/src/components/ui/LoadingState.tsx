import { Card } from './Card'
import { t } from '../../lib/messages'

interface LoadingStateProps {
  title?: string
  description?: string
  blocks?: number
  className?: string
  variant?: 'card' | 'inline'
}

export function LoadingState({
  title,
  description,
  blocks = 3,
  className = '',
  variant = 'card',
}: LoadingStateProps) {
  const gridClassName =
    blocks === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : blocks === 2
        ? 'sm:grid-cols-2'
        : 'sm:grid-cols-3'
  const surfaceClassName =
    variant === 'inline'
      ? 'border-0 bg-transparent px-0 py-8'
      : 'py-10'

  return (
    <Card className={`${surfaceClassName} ${className}`}>
      <div className="mx-auto max-w-lg text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ui-text-muted">
          {t('ui.loadingEyebrow')}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-ui-text">
          {title ?? t('ui.loadingTitle')}
        </h3>
        <p className="mt-2 text-sm text-ui-text-muted">
          {description ?? t('ui.loadingDescription')}
        </p>
      </div>
      <div className={`mt-8 grid gap-3 ${gridClassName}`}>
        {Array.from({ length: blocks }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-ui-card border border-ui-border bg-ui-canvas/70"
          />
        ))}
      </div>
    </Card>
  )
}
