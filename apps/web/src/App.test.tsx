import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders project heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /self-hosted portfolio tracking for long-term investing/i,
      }),
    ).toBeInTheDocument()
  })
})
