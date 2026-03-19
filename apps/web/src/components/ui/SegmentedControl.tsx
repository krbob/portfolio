interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = 'Segmented control',
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
