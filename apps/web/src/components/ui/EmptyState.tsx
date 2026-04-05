import { t } from '../../lib/messages'
import { IconEmptyList } from './icons'
import { StatePanel } from './StatePanel'

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
      icon={<IconEmptyList />}
    />
  )
}
