import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldError } from './FieldError'

describe('FieldError', () => {
  it('renders error message', () => {
    render(<FieldError message="Invalid password" />)
    expect(screen.getByText('Invalid password')).toBeInTheDocument()
  })

  it('renders nothing when message is null', () => {
    const { container } = render(<FieldError message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when message is undefined', () => {
    const { container } = render(<FieldError />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when message is empty string', () => {
    const { container } = render(<FieldError message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('applies error styling', () => {
    render(<FieldError message="Error" />)
    const el = screen.getByText('Error')
    expect(el.className).toContain('text-red-400')
  })
})
