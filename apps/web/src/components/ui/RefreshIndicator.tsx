import { StatusDot } from './StatusDot'
import { t } from '../../lib/messages'

interface RefreshIndicatorProps {
  active: boolean
}

export function RefreshIndicator({ active }: RefreshIndicatorProps) {
  if (!active) return null
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
      <StatusDot status="healthy" pulse />
      {t('common.refreshing')}
    </span>
  )
}
