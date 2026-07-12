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
  default: 'border-ui-border bg-ui-surface-raised text-ui-text-secondary',
  warning: 'border-ui-highlight/30 bg-ui-highlight/5 text-ui-text',
  error: 'border-ui-danger/30 bg-ui-danger/5 text-ui-text',
}

const descriptionToneClasses: Record<StateTone, string> = {
  default: 'text-ui-text-muted',
  warning: 'text-ui-highlight',
  error: 'text-ui-danger',
}

const eyebrowToneClasses: Record<StateTone, string> = {
  default: 'text-ui-text-muted',
  warning: 'text-ui-highlight',
  error: 'text-ui-danger',
}

const iconToneClasses: Record<StateTone, string> = {
  default: 'bg-ui-surface text-ui-text-secondary',
  warning: 'bg-ui-highlight/15 text-ui-highlight',
  error: 'bg-ui-danger/15 text-ui-danger',
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
        <h3 className="mt-2 text-lg font-semibold text-ui-text">{title}</h3>
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
