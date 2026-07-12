import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TabBar } from './TabBar'

afterEach(cleanup)

function Harness() {
  const [value, setValue] = useState<'overview' | 'history' | 'settings'>('overview')
  return (
    <TabBar
      value={value}
      onChange={setValue}
      ariaLabel="Portfolio workspace"
      tabs={[
        { value: 'overview', label: 'Overview' },
        { value: 'history', label: 'History' },
        { value: 'settings', label: 'Settings' },
      ]}
    />
  )
}

describe('TabBar keyboard navigation', () => {
  it('activates tabs with arrows and wraps at either edge', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const overview = screen.getByRole('tab', { name: 'Overview' })
    const history = screen.getByRole('tab', { name: 'History' })
    const settings = screen.getByRole('tab', { name: 'Settings' })
    overview.focus()

    await user.keyboard('{ArrowRight}')
    expect(history).toHaveFocus()
    expect(history).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    expect(settings).toHaveFocus()
    expect(settings).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight}')
    expect(overview).toHaveFocus()
    expect(overview).toHaveAttribute('aria-selected', 'true')
  })

  it('supports Home, End and reverse wrapping', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const overview = screen.getByRole('tab', { name: 'Overview' })
    const settings = screen.getByRole('tab', { name: 'Settings' })
    overview.focus()

    await user.keyboard('{ArrowLeft}')
    expect(settings).toHaveFocus()
    await user.keyboard('{Home}')
    expect(overview).toHaveFocus()
  })
})
