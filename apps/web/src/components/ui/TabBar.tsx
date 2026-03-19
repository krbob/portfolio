interface TabBarProps<T extends string> {
  value: T
  onChange: (value: T) => void
  tabs: { value: T; label: string; count?: number }[]
}

export function TabBar<T extends string>({ value, onChange, tabs }: TabBarProps<T>) {
  return (
    <div className="flex gap-0 border-b border-zinc-800 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.value}
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
