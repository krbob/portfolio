import type { ReactNode } from 'react'
import { card } from '../lib/styles'

interface SectionCardProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export function SectionCard({ eyebrow, title, description, children }: SectionCardProps) {
  return (
    <section className={card}>
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </header>
      {children}
    </section>
  )
}
