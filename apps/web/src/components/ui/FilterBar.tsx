import type { ReactNode } from 'react'
import { t } from '../../lib/messages'
import { btnGhost } from '../../lib/styles'

interface FilterBarProps {
  children: ReactNode
  activeCount: number
  onClear: () => void
  summary?: string
}

export function FilterBar({ children, activeCount, onClear, summary }: FilterBarProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {activeCount > 0 && (
          <button type="button" className={btnGhost} onClick={onClear}>
            {t('ui.clear')} ({activeCount})
          </button>
        )}
      </div>
      {summary && activeCount > 0 && (
        <p className="mt-2 text-xs text-zinc-500">{summary}</p>
      )}
    </div>
  )
}
