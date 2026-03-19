import { Link } from 'react-router-dom'
import { btnPrimary } from '../../lib/styles'

interface EmptyStateProps {
  title: string
  description: string
  action?: { label: string; to: string } | { label: string; onClick: () => void }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <h3 className="text-lg font-semibold text-zinc-300">{title}</h3>
      <p className="mt-2 mx-auto max-w-md text-sm text-zinc-500">{description}</p>
      {action && (
        <div className="mt-6">
          {'to' in action ? (
            <Link to={action.to} className={btnPrimary}>
              {action.label}
            </Link>
          ) : (
            <button className={btnPrimary} onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
