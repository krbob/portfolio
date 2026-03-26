import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = false

function ThrowingChild() {
  if (shouldThrow) {
    throw new Error('test crash')
  }
  return <p>OK</p>
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    shouldThrow = false
    cleanup()
  })

  it('renders children when there is no error', () => {
    shouldThrow = false
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrow = true

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('This view has crashed')).toBeInTheDocument()
    expect(screen.getByText('Reload page')).toBeInTheDocument()
    expect(screen.getByText('Go back')).toBeInTheDocument()

    spy.mockRestore()
  })

  it('calls onReset and recovers when the go-back button is clicked', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReset = vi.fn()
    const user = userEvent.setup()
    shouldThrow = true

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('This view has crashed')).toBeInTheDocument()

    shouldThrow = false
    await user.click(screen.getByText('Go back'))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.getByText('OK')).toBeInTheDocument()

    spy.mockRestore()
  })
})
