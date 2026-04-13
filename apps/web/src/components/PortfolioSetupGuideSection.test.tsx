import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortfolioSetupGuideSection } from './PortfolioSetupGuideSection'
import { usePortfolioSetupGuide } from '../hooks/use-portfolio-setup-guide'

vi.mock('../hooks/use-portfolio-setup-guide', () => ({
  usePortfolioSetupGuide: vi.fn(),
}))

describe('PortfolioSetupGuideSection', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('stays hidden when there are no actionable items', () => {
    vi.mocked(usePortfolioSetupGuide).mockReturnValue({
      items: [],
      doneCount: 7,
      attentionCount: 0,
    })

    render(
      <MemoryRouter>
        <PortfolioSetupGuideSection />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: /next steps/i })).not.toBeInTheDocument()
  })

  it('renders actionable checklist items when attention is needed', () => {
    vi.mocked(usePortfolioSetupGuide).mockReturnValue({
      items: [
        {
          key: 'readiness',
          title: 'Runtime readiness',
          description: 'Resolve runtime blockers or warnings first, otherwise the downstream signals may be misleading.',
          status: 'warning',
          action: {
            kind: 'route',
            to: '/system/diagnostics',
            label: 'Open health',
          },
        },
      ],
      doneCount: 6,
      attentionCount: 1,
    })

    render(
      <MemoryRouter>
        <PortfolioSetupGuideSection />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /next steps/i })).toBeInTheDocument()
    expect(screen.getByText(/runtime readiness/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open health/i })).toHaveAttribute('href', '/system/diagnostics')
  })
})
