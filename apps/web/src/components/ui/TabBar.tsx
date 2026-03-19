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
  return (
    <div className="mb-6 flex gap-0 border-b border-zinc-800" role="tablist" aria-label={ariaLabel}>
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
          className={`relative px-4 py-3 text-sm font-medium transition-colors ${
            value === tab.value
              ? 'text-zinc-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
