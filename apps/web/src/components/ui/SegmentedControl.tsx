import { useEffect, useRef, useState } from 'react'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const hasInitialized = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const activeButton = container.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!activeButton) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    setIndicator({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    })
    hasInitialized.current = true
  }, [value, options])

  return (
    <div
      ref={containerRef}
      className="relative flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1"
      role="group"
      aria-label={ariaLabel}
    >
      <span
        className={`absolute top-1 h-[calc(100%-0.5rem)] rounded-md bg-zinc-700 ${
          hasInitialized.current ? 'transition-[left,width] duration-200 ease-out' : ''
        }`}
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
