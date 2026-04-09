import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-50">{title}</h2>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}
