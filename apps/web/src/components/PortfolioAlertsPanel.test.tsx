import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortfolioAlert } from '../api/read-model'
import { I18nProvider } from '../lib/i18n'
import { PortfolioAlertsPanel } from './PortfolioAlertsPanel'

describe('PortfolioAlertsPanel', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'pl-PL',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['pl-PL'],
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders active portfolio alerts with links to the affected screen', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <PortfolioAlertsPanel
            alerts={[
              {
                id: 'allocation:EQUITIES',
                type: 'ALLOCATION_DRIFT',
                severity: 'WARNING',
                title: 'Dryf alokacji: akcje',
                message: 'Odchylenie wynosi 6.4 pp przy progu 5.00 pp.',
                route: '/strategy/targets',
                observedAt: '2026-07-03T19:45:00Z',
              },
            ] satisfies PortfolioAlert[]}
            isLoading={false}
            isError={false}
            onRetry={vi.fn()}
          />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Aktywne alerty' })).toBeInTheDocument()
    expect(screen.getByText('Dryf alokacji: akcje')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Otwórz' })).toHaveAttribute('href', '/strategy/targets')
  })
})
