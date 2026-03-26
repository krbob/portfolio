import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HoldingsScreen } from './HoldingsScreen'
import { I18nProvider } from '../lib/i18n'
import { usePortfolioHoldings } from '../hooks/use-read-model'

vi.mock('../hooks/use-read-model', () => ({
  usePortfolioHoldings: vi.fn(),
}))

function setLanguage(language: 'pl' | 'en') {
  const locale = language === 'pl' ? 'pl-PL' : 'en-GB'
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: locale,
  })
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: [locale],
  })
}

describe('HoldingsScreen', () => {
  it('describes an empty holdings view without implying missing setup', () => {
    setLanguage('pl')

    vi.mocked(usePortfolioHoldings).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioHoldings>)

    render(
      <MemoryRouter>
        <I18nProvider>
          <HoldingsScreen />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Brak pozycji')).toBeInTheDocument()
    expect(screen.getByText(/Portfel nie ma teraz aktywnych pozycji\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Przejdź do Transakcji' })).toHaveAttribute('href', '/transactions')
  })
})
