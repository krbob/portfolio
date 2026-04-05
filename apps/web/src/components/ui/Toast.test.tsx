import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useToast } from '../../hooks/use-toast'
import { ToastProvider } from './ToastProvider'

function ToastTrigger({ prefix = '' }: { prefix?: string }) {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success(`${prefix}ok`)}>{prefix}btn-success</button>
      <button onClick={() => toast.error(`${prefix}fail`)}>{prefix}btn-error</button>
      <button onClick={() => toast.info(`${prefix}note`)}>{prefix}btn-info</button>
    </>
  )
}

describe('Toast system', () => {
  it('shows a success toast when triggered', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t1-" /></ToastProvider>)

    await user.click(screen.getByText('t1-btn-success'))
    expect(screen.getByText('t1-ok')).toBeInTheDocument()
  })

  it('shows an error toast', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t2-" /></ToastProvider>)

    await user.click(screen.getByText('t2-btn-error'))
    expect(screen.getByText('t2-fail')).toBeInTheDocument()
  })

  it('shows an info toast', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t3-" /></ToastProvider>)

    await user.click(screen.getByText('t3-btn-info'))
    expect(screen.getByText('t3-note')).toBeInTheDocument()
  })

  it('dismisses toast when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t4-" /></ToastProvider>)

    await user.click(screen.getByText('t4-btn-success'))
    expect(screen.getByText('t4-ok')).toBeInTheDocument()

    const toastEl = screen.getByText('t4-ok').closest('div')!
    const closeButton = toastEl.querySelector('button')!
    await user.click(closeButton)
    expect(screen.queryByText('t4-ok')).not.toBeInTheDocument()
  })

  it('applies correct variant styling for success', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t5-" /></ToastProvider>)

    await user.click(screen.getByText('t5-btn-success'))
    const toastEl = screen.getByText('t5-ok').closest('div[class]')!
    expect(toastEl.className).toContain('border-emerald')
  })

  it('applies correct variant styling for error', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t6-" /></ToastProvider>)

    await user.click(screen.getByText('t6-btn-error'))
    const toastEl = screen.getByText('t6-fail').closest('div[class]')!
    expect(toastEl.className).toContain('border-red')
  })

  it('applies correct variant styling for info', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTrigger prefix="t7-" /></ToastProvider>)

    await user.click(screen.getByText('t7-btn-info'))
    const toastEl = screen.getByText('t7-note').closest('div[class]')!
    expect(toastEl.className).toContain('border-blue')
  })

  it('renders nothing when no toasts are active', () => {
    render(<ToastProvider><ToastTrigger prefix="t8-" /></ToastProvider>)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('throws when useToast is called outside provider', () => {
    function Orphan() {
      useToast()
      return null
    }

    expect(() => render(<Orphan />)).toThrow('useToast must be used within a ToastProvider')
  })
})
