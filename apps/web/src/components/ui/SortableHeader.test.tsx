import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SortableHeader } from './SortableHeader'

describe('SortableHeader accessibility', () => {
  it('exposes only the active column sort direction', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()

    render(
      <table>
        <thead>
          <tr>
            <SortableHeader sort={{ field: 'name', direction: 'asc' }} field="name" label="Name" onToggle={onToggle} />
            <SortableHeader sort={{ field: 'name', direction: 'asc' }} field="value" label="Value" onToggle={onToggle} />
          </tr>
        </thead>
      </table>,
    )

    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: 'Value' })).not.toHaveAttribute('aria-sort')

    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(onToggle).toHaveBeenCalledWith({ field: 'name', direction: 'desc' })
  })
})
