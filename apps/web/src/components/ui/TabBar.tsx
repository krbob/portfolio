import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'

interface TabBarProps<T extends string> {
  value: T
  onChange: (value: T) => void
  tabs: { value: T; label: string; count?: number }[]
  ariaLabel?: string
  idBase?: string
}

export function TabBar<T extends string>({
  value,
  onChange,
  tabs,
  ariaLabel = 'Tab bar',
  idBase,
}: TabBarProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const hasInitialized = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const activeButton = container.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    if (!activeButton) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    setIndicator({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    })
    hasInitialized.current = true
  }, [value, tabs])

  return (
    <div ref={containerRef} className="relative mb-6 flex gap-0 border-b border-zinc-800" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          id={idBase ? `${idBase}-tab-${tab.value}` : undefined}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          aria-controls={idBase ? `${idBase}-panel-${tab.value}` : undefined}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'relative px-4 py-3 text-sm font-medium transition-colors',
            value === tab.value ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {tab.count}
            </span>
          )}
        </button>
      ))}
      <span
        className={clsx(
          'absolute bottom-0 h-0.5 rounded-full bg-blue-500',
          hasInitialized.current && 'transition-[left,width] duration-250 ease-out',
        )}
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  )
}
