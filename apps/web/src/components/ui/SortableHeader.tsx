import { th, thRight } from '../../lib/styles'

export type SortDirection = 'asc' | 'desc'

export interface SortState<F extends string = string> {
  field: F
  direction: SortDirection
}

export function SortableHeader<F extends string>({
  sort,
  field,
  label,
  onToggle,
  align,
}: {
  sort: SortState<F>
  field: F
  label: string
  onToggle: (s: SortState<F>) => void
  align?: 'right'
}) {
  const isActive = sort.field === field
  const arrow = !isActive ? '↕' : sort.direction === 'asc' ? '↑' : '↓'
  const base = align === 'right' ? thRight : th

  return (
    <th className={base}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${isActive ? 'text-zinc-300' : ''}`}
        onClick={() =>
          onToggle({ field, direction: isActive && sort.direction === 'desc' ? 'asc' : 'desc' })
        }
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  )
}
