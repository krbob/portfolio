import type { ReactNode } from 'react'

interface SectionCardProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export function SectionCard({ eyebrow, title, description, children }: SectionCardProps) {
  return (
    <section className="panel section-card">
      <header className="section-header">
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      {children}
    </section>
  )
}
