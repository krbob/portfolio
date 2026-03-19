import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { btnPrimary, btnSecondary } from '../../lib/styles'
import { Card } from './Card'

type StateAction = { label: string; to: string } | { label: string; onClick: () => void }
type StateTone = 'default' | 'warning' | 'error'

interface StatePanelProps {
  title: string
  description: string
  action?: StateAction
  eyebrow?: string
  tone?: StateTone
  icon?: ReactNode
  className?: string
}

const toneClasses: Record<StateTone, string> = {
  default: 'border-zinc-800 bg-zinc-900 text-zinc-300',
  warning: 'border-amber-500/25 bg-amber-500/5 text-amber-100',
  error: 'border-red-500/25 bg-red-500/5 text-red-100',
}

const descriptionToneClasses: Record<StateTone, string> = {
  default: 'text-zinc-500',
  warning: 'text-amber-200/70',
  error: 'text-red-200/70',
}

const eyebrowToneClasses: Record<StateTone, string> = {
  default: 'text-zinc-500',
  warning: 'text-amber-300/80',
  error: 'text-red-300/80',
}

const iconToneClasses: Record<StateTone, string> = {
  default: 'bg-zinc-800 text-zinc-300',
  warning: 'bg-amber-500/15 text-amber-300',
  error: 'bg-red-500/15 text-red-300',
}

export function StatePanel({
  title,
  description,
  action,
  eyebrow,
  tone = 'default',
  icon,
  className = '',
}: StatePanelProps) {
  return (
    <Card className={`py-12 text-center ${toneClasses[tone]} ${className}`}>
      <div className="mx-auto flex max-w-lg flex-col items-center">
        {icon && (
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconToneClasses[tone]}`}>
            {icon}
          </div>
        )}
        {eyebrow && (
          <p className={`text-[11px] font-medium uppercase tracking-[0.18em] ${eyebrowToneClasses[tone]}`}>
            {eyebrow}
          </p>
        )}
        <h3 className="mt-2 text-lg font-semibold text-zinc-100">{title}</h3>
        <p className={`mt-2 max-w-md text-sm ${descriptionToneClasses[tone]}`}>{description}</p>
        {action && (
          <div className="mt-6">
            {'to' in action ? (
              <Link
                to={action.to}
                className={tone === 'default' ? btnPrimary : btnSecondary}
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                className={tone === 'default' ? btnPrimary : btnSecondary}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
