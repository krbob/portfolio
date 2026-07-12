import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  flush?: boolean
  as?: 'div' | 'section' | 'article'
}

export function Card({ children, className = '', flush, as = 'div', ...rest }: CardProps) {
  const base = flush
    ? 'rounded-ui-card border border-ui-border bg-ui-surface-raised overflow-hidden'
    : 'rounded-ui-card border border-ui-border bg-ui-surface-raised p-5 overflow-hidden'
  const Component = as
  return (
    <Component className={`${base} ${className}`} {...rest}>
      {children}
    </Component>
  )
}
