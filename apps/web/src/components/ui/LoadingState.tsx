import { Card } from './Card'

interface LoadingStateProps {
  title?: string
  description?: string
  blocks?: number
  className?: string
}

export function LoadingState({
  title = 'Loading portfolio',
  description = 'Fetching the latest holdings, valuation and portfolio read models.',
  blocks = 3,
  className = '',
}: LoadingStateProps) {
  return (
    <Card className={`py-10 ${className}`}>
      <div className="mx-auto max-w-lg text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Loading</p>
        <h3 className="mt-2 text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="mt-2 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: blocks }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-950/70"
          />
        ))}
      </div>
    </Card>
  )
}
