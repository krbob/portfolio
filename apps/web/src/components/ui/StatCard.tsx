interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  change?: 'positive' | 'negative' | 'neutral'
  dot?: 'equity' | 'bond' | 'cash' | string
  hero?: boolean
}

const dotColors: Record<string, string> = {
  equity: 'bg-blue-500',
  bond: 'bg-amber-500',
  cash: 'bg-zinc-500',
}

export function StatCard({ label, value, subtitle, change, dot, hero }: StatCardProps) {
  const dotClass = dot ? dotColors[dot] ?? dot : undefined

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 sm:text-sm sm:normal-case sm:tracking-normal">
        {dotClass && <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />}
        {label}
      </div>
      <div
        className={`mt-2 max-w-full overflow-hidden text-ellipsis font-bold leading-tight tabular-nums ${
          hero ? 'text-[1.85rem] text-zinc-50 sm:text-3xl' : 'text-[1.5rem] sm:text-2xl'
        } ${
          change === 'positive' ? 'text-emerald-400' : change === 'negative' ? 'text-red-400' : ''
        }`}
      >
        {value}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm sm:tabular-nums">{subtitle}</p>
      )}
    </div>
  )
}
