import type { ReactNode } from 'react'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div>
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{eyebrow}</p>
        )}
        <h3 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h3>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
