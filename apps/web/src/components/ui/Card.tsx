import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  flush?: boolean
  as?: 'div' | 'section' | 'article'
}

export function Card({ children, className = '', flush, as = 'div', ...rest }: CardProps) {
  const base = flush
    ? 'rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden'
    : 'rounded-xl border border-zinc-800 bg-zinc-900 p-5 overflow-hidden'
  const Component = as
  return (
    <Component className={`${base} ${className}`} {...rest}>
      {children}
    </Component>
  )
}
