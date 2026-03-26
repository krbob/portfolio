import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../lib/i18n'
import { FilterBar } from './FilterBar'

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

describe('FilterBar', () => {
  it('renders a translated clear button in Polish', () => {
    setLanguage('pl')

    render(
      <I18nProvider>
        <FilterBar activeCount={1} onClear={() => {}}>
          <div>filters</div>
        </FilterBar>
      </I18nProvider>,
    )

    expect(screen.getByRole('button', { name: 'Wyczyść (1)' })).toBeInTheDocument()
  })

  it('renders a clear button in English', () => {
    setLanguage('en')

    render(
      <I18nProvider>
        <FilterBar activeCount={2} onClear={() => {}}>
          <div>filters</div>
        </FilterBar>
      </I18nProvider>,
    )

    expect(screen.getByRole('button', { name: 'Clear (2)' })).toBeInTheDocument()
  })
})
