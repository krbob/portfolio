import type { ReactNode } from 'react'
import { badgeVariants } from '../../lib/styles'

type BadgeVariant = keyof typeof badgeVariants

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badgeVariants[variant]}`}>
      {children}
    </span>
  )
}
