import clsx from 'clsx'
import { Link } from 'react-router-dom'

interface StatCardProps {
  label: string
  value: string
  numericValue?: number
  subtitle?: string
  change?: 'positive' | 'negative' | 'neutral'
  dot?: 'equity' | 'bond' | 'cash' | string
  hero?: boolean
  loading?: boolean
  to?: string
}

const dotColors: Record<string, string> = {
  equity: 'bg-ui-action',
  bond: 'bg-ui-highlight',
  cash: 'bg-ui-text-muted',
}

export function StatCard({ label, value, numericValue, subtitle, change, dot, hero, loading, to }: StatCardProps) {
  const dotClass = dot ? dotColors[dot] ?? dot : undefined
  const isZero = numericValue != null ? numericValue === 0 : value === '0' || value === '0,00 zł' || value === '0.00 zł'
  const isLong = value.length > 10

  const content = (
    <div
      className={clsx(
        'min-h-[5.5rem] rounded-ui-card border border-ui-border bg-ui-surface-raised p-4 sm:min-h-[6rem] sm:p-5',
        to && 'transition-colors hover:border-ui-border-strong',
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ui-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
        {dotClass && <span className={clsx('inline-block h-2 w-2 rounded-full', dotClass)} />}
        {label}
      </div>
      <div
        className={clsx(
          'mt-2 max-w-full overflow-hidden text-ellipsis font-bold leading-tight tabular-nums',
          loading && 'animate-pulse',
          hero
            ? [isLong ? 'text-xl sm:text-2xl' : 'text-[1.85rem] sm:text-3xl', 'text-ui-text']
            : isLong ? 'text-lg sm:text-xl' : 'text-[1.5rem] sm:text-2xl',
          isZero
            ? 'text-ui-text-muted'
            : change === 'positive'
              ? 'text-ui-positive'
              : change === 'negative'
                ? 'text-ui-negative'
                : undefined,
        )}
      >
        {value}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-ui-text-muted sm:text-sm sm:tabular-nums">{subtitle}</p>
      )}
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-ui-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-action/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ui-canvas"
      >
        {content}
      </Link>
    )
  }

  return content
}
