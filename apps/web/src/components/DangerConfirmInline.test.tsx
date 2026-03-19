import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DangerConfirmInline } from './DangerConfirmInline'

describe('DangerConfirmInline', () => {
  it('calls cancel and confirm handlers', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <DangerConfirmInline
        title="Delete transaction?"
        description="This removes the canonical event from the journal."
        confirmLabel="Delete"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
