import { useEffect, useState } from 'react'
import { t } from '../../lib/messages'
import { StatusDot } from './StatusDot'

interface InlineRefreshIndicatorProps {
  active: boolean
  delayMs?: number
}

export function InlineRefreshIndicator({ active, delayMs = 400 }: InlineRefreshIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    const timeoutId = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [active, delayMs])

  if (!visible) {
    return null
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-zinc-500"
    >
      <StatusDot status="healthy" pulse />
      {t('common.refreshing')}
    </span>
  )
}
