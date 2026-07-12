// Shared Tailwind class constants for consistent styling across the app.

// Surfaces
export const card = 'rounded-ui-card border border-ui-border bg-ui-surface-raised p-5'
export const cardFlush = 'rounded-ui-card border border-ui-border bg-ui-surface-raised overflow-hidden'
export const cardHeader = 'border-b border-ui-border px-5 py-4'

// Inputs
export const input =
  'w-full min-w-0 rounded-ui-field border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text placeholder:text-ui-text-muted focus:border-ui-action focus:outline-none focus:ring-1 focus:ring-ui-action/30'
export const filterInput =
  'rounded-ui-field border border-ui-border-strong bg-ui-surface px-2.5 py-2 sm:py-1.5 text-sm text-ui-text focus:border-ui-action focus:outline-none'
export const inputError =
  'w-full min-w-0 rounded-ui-field border border-ui-danger/50 bg-ui-surface px-3 py-2 text-sm text-ui-text placeholder:text-ui-text-muted focus:border-ui-danger focus:outline-none focus:ring-1 focus:ring-ui-danger/30'
export const label = 'block text-xs font-medium text-ui-text-muted mb-1.5'

// Buttons
export const btnPrimary =
  'rounded-ui-control border border-ui-action bg-ui-surface-raised px-4 py-2 text-sm font-medium text-ui-action hover:bg-ui-action/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
export const btnSecondary =
  'rounded-ui-control border border-ui-border-strong bg-ui-surface px-4 py-2 text-sm font-medium text-ui-text-secondary hover:text-ui-text disabled:opacity-50 transition-colors'
export const btnGhost =
  'rounded-ui-control px-3 py-2 sm:py-1.5 text-sm font-medium text-ui-text-muted hover:bg-ui-surface hover:text-ui-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
export const btnDanger =
  'rounded-ui-control bg-ui-danger/15 px-3 py-2 sm:py-1.5 text-sm font-medium text-ui-danger hover:bg-ui-danger/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

// Table
export const th = 'px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-ui-text-muted'
export const thRight = 'px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-ui-text-muted'
export const td = 'px-5 py-3 text-sm'
export const tdRight = 'px-5 py-3 text-sm text-right tabular-nums'
export const tdMono = 'px-5 py-3 text-sm font-mono font-medium text-ui-text-secondary'
export const tr = 'border-b border-ui-border/50 last:border-0'

// Badge
export const badge = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium'

// Badge variants
export const badgeVariants = {
  default: 'bg-ui-surface text-ui-text-muted',
  success: 'bg-ui-positive/15 text-ui-positive',
  warning: 'bg-ui-highlight/15 text-ui-highlight',
  error: 'bg-ui-danger/15 text-ui-danger',
  info: 'bg-ui-action/15 text-ui-action',
  equity: 'bg-ui-action/15 text-ui-action',
  bond: 'bg-ui-highlight/15 text-ui-highlight',
  cash: 'bg-ui-text-muted/15 text-ui-text-muted',
} as const

// Transaction type badge colors
export const txBadgeVariants = {
  BUY: 'bg-ui-positive/15 text-ui-positive',
  SELL: 'bg-ui-negative/15 text-ui-negative',
  REDEEM: 'bg-ui-negative/15 text-ui-negative',
  DEPOSIT: 'bg-ui-action/15 text-ui-action',
  WITHDRAWAL: 'bg-ui-highlight/15 text-ui-highlight',
  FEE: 'bg-ui-text-muted/15 text-ui-text-muted',
  TAX: 'bg-ui-text-muted/15 text-ui-text-muted',
  INTEREST: 'bg-ui-positive/15 text-ui-positive',
  CORRECTION: 'bg-ui-text-muted/15 text-ui-text-muted',
} as const

// Valuation status badge colors
export const valuationBadgeVariants: Record<string, string> = {
  VALUED: 'bg-ui-positive/15 text-ui-positive',
  STALE: 'bg-ui-action/15 text-ui-action',
  BOOK_ONLY: 'bg-ui-highlight/15 text-ui-highlight',
  UNAVAILABLE: 'bg-ui-danger/15 text-ui-danger',
}
