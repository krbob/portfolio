import type { ReactNode } from 'react'
import { formatMessage, t } from '../../lib/messages'
import { th, td } from '../../lib/styles'

export interface ChartDataRow {
  key: string
  cells: ReactNode[]
}

interface ChartDataTableProps {
  caption: string
  columns: string[]
  rows: ChartDataRow[]
  maxRows?: number
}

export function ChartDataTable({ caption, columns, rows, maxRows = 48 }: ChartDataTableProps) {
  const sampledRows = sampleEvenly(rows, maxRows)

  return (
    <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/30 text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium text-zinc-300">
        {t('chart.showData')}
      </summary>
      <div className="border-t border-zinc-800 p-3">
        {sampledRows.length < rows.length ? (
          <p className="mb-2 text-xs text-zinc-400">
            {formatMessage(t('chart.sampledRows'), { shown: sampledRows.length, total: rows.length })}
          </p>
        ) : null}
        <div className="max-h-80 overflow-auto">
          <table className="min-w-full">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-zinc-950">
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className={th}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampledRows.map((row) => (
                <tr key={row.key} className="border-b border-zinc-800/50 last:border-0">
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}:${columns[index] ?? index}`} className={`${td} whitespace-nowrap text-zinc-300`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

export function sampleEvenly<T>(rows: T[], maxRows: number): T[] {
  if (maxRows < 2 || rows.length <= maxRows) return rows

  return Array.from({ length: maxRows }, (_, index) => {
    const sourceIndex = Math.round((index * (rows.length - 1)) / (maxRows - 1))
    return rows[sourceIndex]
  })
}
