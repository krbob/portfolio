import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PortfolioHolding } from '../../api/read-model'
import { I18nProvider } from '../../lib/i18n'
import { PerformanceContributors } from './PerformanceContributors'

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

function makeHolding(overrides: Partial<PortfolioHolding> & { instrumentName: string }): PortfolioHolding {
  return {
    accountId: 'acc-1',
    accountName: 'Primary',
    instrumentId: 'ins-1',
    kind: 'ETF',
    assetClass: 'EQUITIES',
    currency: 'USD',
    quantity: '10',
    averageCostPerUnitPln: '100.00',
    costBasisPln: '1000.00',
    bookValuePln: '1000.00',
    currentPricePln: '120.00',
    currentValuePln: '1200.00',
    unrealizedGainPln: null,
    valuedAt: '2026-03-20',
    valuationStatus: 'VALUED',
    valuationIssue: null,
    transactionCount: 1,
    ...overrides,
  } as PortfolioHolding
}

function renderComponent(holdings: PortfolioHolding[]) {
  setLanguage('en')
  return render(
    <I18nProvider>
      <PerformanceContributors holdings={holdings} />
    </I18nProvider>,
  )
}

describe('PerformanceContributors', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows top 3 sorted by gain desc and bottom 3 sorted by gain asc', () => {
    const holdings = [
      makeHolding({ instrumentName: 'AAA', unrealizedGainPln: '500.00' }),
      makeHolding({ instrumentName: 'BBB', unrealizedGainPln: '300.00' }),
      makeHolding({ instrumentName: 'CCC', unrealizedGainPln: '100.00' }),
      makeHolding({ instrumentName: 'DDD', unrealizedGainPln: '-50.00' }),
      makeHolding({ instrumentName: 'EEE', unrealizedGainPln: '-200.00' }),
      makeHolding({ instrumentName: 'FFF', unrealizedGainPln: '-400.00' }),
      makeHolding({ instrumentName: 'GGG', unrealizedGainPln: '50.00' }),
    ]

    renderComponent(holdings)

    // Both section headings should be present
    expect(screen.getByText('Top performers')).toBeInTheDocument()
    expect(screen.getByText('Bottom performers')).toBeInTheDocument()

    // Top 3: AAA (500), BBB (300), CCC (100)
    const topList = screen.getByText('Top performers').closest('div')!
    const topItems = topList.querySelectorAll('li')
    expect(topItems).toHaveLength(3)
    expect(topItems[0].textContent).toContain('AAA')
    expect(topItems[1].textContent).toContain('BBB')
    expect(topItems[2].textContent).toContain('CCC')

    // Bottom 3: FFF (-400), EEE (-200), DDD (-50)
    const bottomList = screen.getByText('Bottom performers').closest('div')!
    const bottomItems = bottomList.querySelectorAll('li')
    expect(bottomItems).toHaveLength(3)
    expect(bottomItems[0].textContent).toContain('FFF')
    expect(bottomItems[1].textContent).toContain('EEE')
    expect(bottomItems[2].textContent).toContain('DDD')
  })

  it('excludes holdings without unrealizedGainPln', () => {
    const holdings = [
      makeHolding({ instrumentName: 'WithGain', unrealizedGainPln: '100.00' }),
      makeHolding({ instrumentName: 'NoGain', unrealizedGainPln: null }),
      makeHolding({ instrumentName: 'AlsoNoGain' }),
    ]

    renderComponent(holdings)

    expect(screen.getAllByText('WithGain').length).toBeGreaterThan(0)
    expect(screen.queryByText('NoGain')).not.toBeInTheDocument()
    expect(screen.queryByText('AlsoNoGain')).not.toBeInTheDocument()
  })

  it('shows empty state when no holdings have gain data', () => {
    const holdings = [
      makeHolding({ instrumentName: 'NoGain', unrealizedGainPln: null }),
    ]

    renderComponent(holdings)

    expect(screen.getByText('No market-valued holdings.')).toBeInTheDocument()
    expect(screen.queryByText('Top performers')).not.toBeInTheDocument()
  })

  it('shows empty state when holdings array is empty', () => {
    renderComponent([])

    expect(screen.getByText('No market-valued holdings.')).toBeInTheDocument()
  })
})
