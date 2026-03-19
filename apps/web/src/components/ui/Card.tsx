import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  flush?: boolean
}

export function Card({ children, className = '', flush }: CardProps) {
  const base = flush
    ? 'rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden'
    : 'rounded-xl border border-zinc-800 bg-zinc-900 p-5'
  return <div className={`${base} ${className}`}>{children}</div>
}
