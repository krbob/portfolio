// Shared Tailwind class constants for consistent styling across the app.

// Surfaces
export const card = 'rounded-xl border border-zinc-800 bg-zinc-900 p-5'
export const cardFlush = 'rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden'
export const cardHeader = 'border-b border-zinc-800 px-5 py-4'

// Inputs
export const input =
  'w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30'
export const filterInput =
  'rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none'
export const label = 'block text-xs font-medium text-zinc-500 mb-1.5'

// Buttons
export const btnPrimary =
  'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
export const btnSecondary =
  'rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-50 transition-colors'
export const btnGhost =
  'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
export const btnDanger =
  'rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

// Table
export const th = 'px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500'
export const thRight = 'px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500'
export const td = 'px-5 py-3 text-sm'
export const tdRight = 'px-5 py-3 text-sm text-right tabular-nums'
export const tdMono = 'px-5 py-3 text-sm font-mono font-medium text-zinc-300'
export const tr = 'border-b border-zinc-800/50 last:border-0'

// Badge
export const badge = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium'

// Badge variants
export const badgeVariants = {
  default: 'bg-zinc-800 text-zinc-400',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
  equity: 'bg-blue-500/15 text-blue-400',
  bond: 'bg-amber-500/15 text-amber-400',
  cash: 'bg-zinc-500/15 text-zinc-400',
} as const

// Transaction type badge colors
export const txBadgeVariants = {
  BUY: 'bg-emerald-500/15 text-emerald-400',
  SELL: 'bg-red-500/15 text-red-400',
  REDEEM: 'bg-red-500/15 text-red-400',
  DIVIDEND: 'bg-emerald-500/15 text-emerald-400',
  DEPOSIT: 'bg-blue-500/15 text-blue-400',
  WITHDRAWAL: 'bg-amber-500/15 text-amber-400',
  FEE: 'bg-zinc-500/15 text-zinc-400',
  TAX: 'bg-zinc-500/15 text-zinc-400',
  INTEREST: 'bg-emerald-500/15 text-emerald-400',
  CORRECTION: 'bg-zinc-500/15 text-zinc-400',
} as const

// Valuation status badge colors
export const valuationBadgeVariants: Record<string, string> = {
  VALUED: 'bg-emerald-500/15 text-emerald-400',
  STALE: 'bg-sky-500/15 text-sky-300',
  BOOK_ONLY: 'bg-amber-500/15 text-amber-400',
  UNAVAILABLE: 'bg-red-500/15 text-red-400',
}
