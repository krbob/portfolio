import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total" value="1 234,56 zł" />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('1 234,56 zł')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<StatCard label="Total" value="100 zł" subtitle="3 accounts" />)
    expect(screen.getByText('3 accounts')).toBeInTheDocument()
  })

  it('does not render subtitle when omitted', () => {
    const { container } = render(<StatCard label="Total" value="100 zł" />)
    expect(container.querySelector('p')).toBeNull()
  })

  it('renders colored dot for equity', () => {
    const { container } = render(<StatCard label="Equities" value="100 zł" dot="equity" />)
    const dot = container.querySelector('.bg-blue-500')
    expect(dot).toBeInTheDocument()
  })

  it('renders colored dot for bond', () => {
    const { container } = render(<StatCard label="Bonds" value="50 zł" dot="bond" />)
    const dot = container.querySelector('.bg-amber-500')
    expect(dot).toBeInTheDocument()
  })

  it('applies positive change color', () => {
    render(<StatCard label="Change" value="+10 zł" change="positive" />)
    const valueEl = screen.getByText('+10 zł')
    expect(valueEl.className).toContain('text-emerald-400')
  })

  it('applies negative change color', () => {
    render(<StatCard label="Change" value="-10 zł" change="negative" />)
    const valueEl = screen.getByText('-10 zł')
    expect(valueEl.className).toContain('text-red-400')
  })

  it('applies animate-pulse when loading', () => {
    render(<StatCard label="Change" value="—" loading />)
    const valueEl = screen.getByText('—')
    expect(valueEl.className).toContain('animate-pulse')
  })

  describe('zero detection with numericValue', () => {
    it('detects zero via numericValue prop', () => {
      render(<StatCard label="Value" value="0,00 PLN" numericValue={0} />)
      const valueEl = screen.getByText('0,00 PLN')
      expect(valueEl.className).toContain('text-zinc-600')
    })

    it('does not treat non-zero numericValue as zero', () => {
      render(<StatCard label="Value" value="0,01 zł" numericValue={0.01} />)
      const valueEl = screen.getByText('0,01 zł')
      expect(valueEl.className).not.toContain('text-zinc-600')
    })

    it('falls back to string matching when numericValue is omitted', () => {
      render(<StatCard label="Value" value="0,00 zł" />)
      const valueEl = screen.getByText('0,00 zł')
      expect(valueEl.className).toContain('text-zinc-600')
    })

    it('does not false-positive on formatted strings not in allowlist', () => {
      render(<StatCard label="Value" value="0,00 EUR" />)
      const valueEl = screen.getByText('0,00 EUR')
      expect(valueEl.className).not.toContain('text-zinc-600')
    })
  })
})
