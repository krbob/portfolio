interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = 'h-28' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 ${className}`} />
}
