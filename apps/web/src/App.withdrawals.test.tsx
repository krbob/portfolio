import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import { createStorageMock } from './test/app-smoke-fixtures'

describe('withdrawal planner route', () => {
  beforeEach(() => {
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'pl-PL' })
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['pl-PL'] })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the withdrawals tab directly at /strategy/withdrawals', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/auth/session')) {
        return jsonResponse({ authEnabled: false, authenticated: true, mode: 'DISABLED' })
      }
      if (url.includes('/api/v1/meta')) {
        return jsonResponse({
          name: 'Portfolio',
          stage: 'test',
          version: 'test',
          auth: { enabled: false, mode: 'DISABLED' },
          stack: { web: 'React', api: 'Kotlin', database: 'SQLite' },
          capabilities: [],
        })
      }
      if (url.includes('/api/v1/readiness')) {
        return jsonResponse({ status: 'READY', checkedAt: '2026-07-18T10:00:00Z', checks: [] })
      }
      if (url.includes('/api/v1/portfolio/overview')) {
        return jsonResponse(null)
      }
      if (url.includes('/api/v1/portfolio/market-data-snapshots')) {
        return jsonResponse([])
      }
      if (url.includes('/api/v1/portfolio/withdrawal-settings')) {
        return jsonResponse({ accountRules: [] })
      }
      if (url.includes('/api/v1/accounts')) {
        return jsonResponse([])
      }
      throw new Error(`Unhandled fetch in withdrawal route test: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter initialEntries={['/strategy/withdrawals']}>
            <App />
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Strategia portfela' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Wypłaty' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('heading', { name: 'Plan wypłaty' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Konta i bufory podatkowe' })).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
