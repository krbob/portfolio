import { StatePanel } from './StatePanel'
import { t } from '../../lib/messages'

interface EmptyStateProps {
  title: string
  description: string
  action?: { label: string; to: string } | { label: string; onClick: () => void }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <StatePanel
      eyebrow={t('ui.empty')}
      title={title}
      description={description}
      action={action}
      icon={
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h9"
          />
        </svg>
      }
    />
  )
}
