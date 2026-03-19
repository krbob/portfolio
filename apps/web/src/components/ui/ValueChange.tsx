import { formatCurrencyPln, formatPercent } from '../../lib/format'

interface ValueChangeProps {
  value: number
  format: 'pct' | 'pln'
  size?: 'sm' | 'md' | 'lg'
  showSign?: boolean
}

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
} as const

export function ValueChange({ value, format, size = 'md', showSign = true }: ValueChangeProps) {
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-zinc-400'
  const sign = showSign && value > 0 ? '+' : ''

  let formatted: string
  if (format === 'pct') {
    formatted = `${sign}${formatPercent(value)}`
  } else {
    formatted = `${sign}${formatCurrencyPln(value)}`
  }

  return <span className={`font-medium tabular-nums ${color} ${sizeClasses[size]}`}>{formatted}</span>
}
