import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { PortfolioAlertSettingsSection } from './PortfolioAlertSettingsSection'

describe('PortfolioAlertSettingsSection', () => {
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

  it('loads alert settings and saves the selected alert policy', async () => {
    const postBodies: unknown[] = []
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/portfolio/alert-settings') && init?.method === 'POST') {
        postBodies.push(JSON.parse(String(init.body)))
        return jsonResponse({
          enabled: true,
          pushEnabled: false,
          enabledTypes: ['ALLOCATION_DRIFT', 'MARKET_DATA_STALE'],
          allocationDriftThresholdPctPoints: '7.50',
          benchmarkUnderperformanceThresholdPctPoints: '4.25',
        })
      }

      if (url.includes('/api/v1/portfolio/alert-settings')) {
        return jsonResponse({
          enabled: true,
          pushEnabled: true,
          enabledTypes: ['ALLOCATION_DRIFT', 'MARKET_DATA_STALE', 'BENCHMARK_UNDERPERFORMANCE'],
          allocationDriftThresholdPctPoints: '5.00',
          benchmarkUnderperformanceThresholdPctPoints: '5.00',
        })
      }

      throw new Error(`Unhandled fetch in alert settings test: ${url}`)
    })

    renderSection()

    expect(await screen.findByRole('heading', { name: 'Konfiguracja alertów portfela' })).toBeInTheDocument()

    await userEvent.click(await screen.findByLabelText(/wysyłka push/i))
    await userEvent.click(screen.getByLabelText(/słabszy wynik benchmarku/i))
    await userEvent.clear(screen.getByLabelText(/próg dryfu alokacji/i))
    await userEvent.type(screen.getByLabelText(/próg dryfu alokacji/i), '7,5')
    await userEvent.clear(screen.getByLabelText(/próg wyniku względem benchmarku/i))
    await userEvent.type(screen.getByLabelText(/próg wyniku względem benchmarku/i), '4.25')
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz alerty' }))

    await waitFor(() => {
      expect(postBodies).toHaveLength(1)
    })
    expect(postBodies[0]).toEqual({
      enabled: true,
      pushEnabled: false,
      enabledTypes: ['ALLOCATION_DRIFT', 'MARKET_DATA_STALE'],
      allocationDriftThresholdPctPoints: '7.50',
      benchmarkUnderperformanceThresholdPctPoints: '4.25',
    })
    expect(await screen.findByText('Zapisano konfigurację alertów. Aktywne typy: 2.')).toBeInTheDocument()
  })
})

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PortfolioAlertSettingsSection />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
