import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DashboardSetupBanner } from './DashboardSetupBanner'
import { usePortfolioSetupGuide } from '../hooks/use-portfolio-setup-guide'

vi.mock('../hooks/use-portfolio-setup-guide', () => ({
  usePortfolioSetupGuide: vi.fn(),
}))

describe('DashboardSetupBanner', () => {
  it('stays hidden when there are no actionable checklist items', () => {
    vi.mocked(usePortfolioSetupGuide).mockReturnValue({
      items: [],
      doneCount: 7,
      attentionCount: 0,
    })

    render(
      <MemoryRouter>
        <DashboardSetupBanner />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: /there are open setup or data-trust items/i })).not.toBeInTheDocument()
  })

  it('shows a compact banner with a link to the checklist page', () => {
    vi.mocked(usePortfolioSetupGuide).mockReturnValue({
      items: [],
      doneCount: 4,
      attentionCount: 2,
    })

    render(
      <MemoryRouter>
        <DashboardSetupBanner />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /there are open setup or data-trust items/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open checklist/i })).toHaveAttribute('href', '/setup')
  })
})
