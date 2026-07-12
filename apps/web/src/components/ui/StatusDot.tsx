const statusColors = {
  healthy: 'bg-ui-positive',
  warning: 'bg-ui-highlight',
  error: 'bg-ui-danger',
  unknown: 'bg-ui-text-muted',
} as const

interface StatusDotProps {
  status: keyof typeof statusColors
  size?: 'sm' | 'md'
  pulse?: boolean
}

export function StatusDot({ status, size = 'sm', pulse }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
  return (
    <span
      className={`inline-block rounded-full ${sizeClass} ${statusColors[status]} ${pulse ? 'animate-pulse' : ''}`}
    />
  )
}
