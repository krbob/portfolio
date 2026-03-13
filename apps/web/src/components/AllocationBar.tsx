interface AllocationBarProps {
  equityWeightPct: number
  bondWeightPct: number
  cashWeightPct: number
}

export function AllocationBar({ equityWeightPct, bondWeightPct, cashWeightPct }: AllocationBarProps) {
  const segments = [
    { label: 'Equities', value: equityWeightPct, className: 'allocation-segment-equity' },
    { label: 'Bonds', value: bondWeightPct, className: 'allocation-segment-bond' },
    { label: 'Cash', value: cashWeightPct, className: 'allocation-segment-cash' },
  ]

  return (
    <div className="allocation-card">
      <div className="allocation-header">
        <div>
          <strong>Current allocation</strong>
          <p className="muted-copy">Portfolio split by market value across the active asset buckets.</p>
        </div>
      </div>

      <div className="allocation-bar" aria-label="Portfolio allocation">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={`allocation-segment ${segment.className}`}
            style={{ width: `${Math.max(segment.value, 0)}%` }}
          />
        ))}
      </div>

      <div className="allocation-legend">
        {segments.map((segment) => (
          <span key={segment.label} className="allocation-legend-item">
            <i className={`legend-dot ${segment.className}`} />
            {segment.label} {segment.value.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
