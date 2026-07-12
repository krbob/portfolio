import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Modal } from './Modal'

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open editor</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit holding"
        footer={<button type="button">Save holding</button>}
      >
        <label>
          Holding name
          <input />
        </label>
      </Modal>
    </>
  )
}

describe('Modal keyboard accessibility', () => {
  it('traps forward and reverse tab navigation and restores focus after Escape', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    const opener = screen.getByRole('button', { name: 'Open editor' })
    await user.click(opener)

    const dialog = await screen.findByRole('dialog', { name: 'Edit holding' })
    const close = screen.getByRole('button', { name: /close|zamknij/i })
    const save = screen.getByRole('button', { name: 'Save holding' })

    expect(dialog).toBeInTheDocument()
    expect(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await user.tab({ shift: true })
    expect(save).toHaveFocus()

    await user.tab()
    expect(close).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
