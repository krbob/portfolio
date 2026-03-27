import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
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
  afterEach(() => cleanup())

  it('localizes the benchmark legend in Polish', () => {
    setLanguage('pl')

    render(
      <I18nProvider>
        <BenchmarkChart points={[]} />
      </I18nProvider>,
    )

    expect(screen.getByText('Porównanie z benchmarkiem')).toBeInTheDocument()
    expect(screen.getByText('Portfel')).toBeInTheDocument()
    expect(screen.getByLabelText('Wybierz benchmark')).toBeInTheDocument()
    expect(screen.queryByText(/^Portfolio$/)).not.toBeInTheDocument()
  })

  it('switches the displayed benchmark via the select dropdown', async () => {
    setLanguage('pl')
    const user = userEvent.setup()

    render(
      <I18nProvider>
        <BenchmarkChart points={[]} />
      </I18nProvider>,
    )

    const select = screen.getByLabelText('Wybierz benchmark') as HTMLSelectElement
    expect(select.value).toBe('equityBenchmarkIndex')

    await user.selectOptions(select, 'inflationBenchmarkIndex')

    expect(select.value).toBe('inflationBenchmarkIndex')
  })
})
