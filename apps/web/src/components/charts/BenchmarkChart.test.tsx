import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../lib/i18n'
import { BenchmarkChart } from './BenchmarkChart'

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

describe('BenchmarkChart', () => {
  it('localizes the benchmark legend in Polish', () => {
    setLanguage('pl')

    render(
      <I18nProvider>
        <BenchmarkChart points={[]} />
      </I18nProvider>,
    )

    expect(screen.getByText('Porównanie benchmarków')).toBeInTheDocument()
    expect(screen.getByText('Portfel')).toBeInTheDocument()
    expect(screen.getByText('Inflacja')).toBeInTheDocument()
    expect(screen.getByText('Miks docelowy')).toBeInTheDocument()
    expect(screen.queryByText(/^Portfolio$/)).not.toBeInTheDocument()
  })
})
