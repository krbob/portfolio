import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ChartDataTable, sampleEvenly } from './ChartDataTable'

describe('ChartDataTable', () => {
  it('provides a keyboard-operable, captioned data alternative', async () => {
    const user = userEvent.setup()
    render(
      <ChartDataTable
        caption="Portfolio value history"
        columns={['Date', 'Value']}
        rows={[
          { key: 'one', cells: ['2026-01-01', '100'] },
          { key: 'two', cells: ['2026-01-02', '105'] },
        ]}
      />,
    )

    const toggle = screen.getByText(/show chart data|pokaż dane wykresu/i)
    await user.click(toggle)

    const table = screen.getByRole('table', { name: 'Portfolio value history' })
    expect(within(table).getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: '105' })).toBeInTheDocument()
  })

  it('samples long histories evenly while preserving both endpoints', () => {
    const rows = Array.from({ length: 100 }, (_, index) => index)
    const sampled = sampleEvenly(rows, 10)

    expect(sampled).toHaveLength(10)
    expect(sampled[0]).toBe(0)
    expect(sampled.at(-1)).toBe(99)
  })
})
