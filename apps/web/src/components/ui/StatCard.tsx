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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
        {dotClass && <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />}
        {label}
      </div>
      <div
        className={`mt-1 font-bold tabular-nums ${hero ? 'text-3xl text-zinc-50' : 'text-2xl'} ${
          change === 'positive' ? 'text-emerald-400' : change === 'negative' ? 'text-red-400' : ''
        }`}
      >
        {value}
      </div>
      {subtitle && (
        <p className="mt-0.5 text-sm tabular-nums text-zinc-500">{subtitle}</p>
      )}
    </div>
  )
}
