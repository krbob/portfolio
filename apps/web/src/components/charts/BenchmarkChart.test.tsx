import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { PortfolioDailyHistoryPoint } from '../../api/read-model'
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

const samplePoints: PortfolioDailyHistoryPoint[] = [
  {
    date: '2026-03-01',
    totalBookValuePln: '1000.00',
    totalCurrentValuePln: '1000.00',
    netContributionsPln: '1000.00',
    cashBalancePln: '1000.00',
    totalCurrentValueUsd: '250.00',
    netContributionsUsd: '250.00',
    cashBalanceUsd: '250.00',
    totalCurrentValueAu: null,
    netContributionsAu: null,
    cashBalanceAu: null,
    equityCurrentValuePln: '0.00',
    bondCurrentValuePln: '0.00',
    cashCurrentValuePln: '1000.00',
    equityAllocationPct: '0.00',
    bondAllocationPct: '0.00',
    cashAllocationPct: '100.00',
    portfolioPerformanceIndex: '100.00',
    benchmarkIndices: { VWRA: '100.00', INFLATION: '101.00' },
    activeHoldingCount: 0,
    valuedHoldingCount: 0,
  },
]

const orderedPoints: PortfolioDailyHistoryPoint[] = [
  {
    ...samplePoints[0],
    benchmarkIndices: { VWRA: '100.00', CUSTOM_1: '99.50', TARGET_MIX: '100.20' },
  },
]

describe('BenchmarkChart', () => {
  afterEach(() => cleanup())

  it('localizes the benchmark legend in Polish', () => {
    setLanguage('pl')

    render(
      <I18nProvider>
        <BenchmarkChart points={samplePoints} />
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
        <BenchmarkChart points={samplePoints} />
      </I18nProvider>,
    )

    const select = screen.getByLabelText('Wybierz benchmark') as HTMLSelectElement
    expect(select.value).toBe('VWRA')

    await user.selectOptions(select, 'INFLATION')

    expect(select.value).toBe('INFLATION')
  })

  it('prefers the configured order and custom label when provided', () => {
    setLanguage('pl')

    render(
      <I18nProvider>
        <BenchmarkChart
          points={orderedPoints}
          benchmarkOrder={['CUSTOM_1', 'VWRA']}
          customBenchmarkLabels={{ CUSTOM_1: 'Europa 600' }}
        />
      </I18nProvider>,
    )

    const select = screen.getByLabelText('Wybierz benchmark') as HTMLSelectElement
    expect(select.value).toBe('CUSTOM_1')
    expect(screen.getByRole('option', { name: 'Europa 600' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /miks docelowy/i })).not.toBeInTheDocument()
  })
})
