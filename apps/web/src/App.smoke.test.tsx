import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import { createAppFetchMock, createStorageMock, createTestQueryClient } from './test/app-smoke-fixtures'

const ROUTE_CASES = [
  { route: '/', heading: 'Pulpit' },
  { route: '/portfolio', heading: 'Portfel' },
  { route: '/portfolio/accounts', heading: 'Portfel' },
  { route: '/strategy/instruments', heading: 'Strategia portfela' },
  { route: '/transactions', heading: 'Transakcje' },
  { route: '/performance', heading: 'Wyniki' },
] as const

describe('App smoke', () => {
  beforeEach(() => {
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'pl-PL',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['pl-PL'],
    })
    globalThis.fetch = createAppFetchMock()
  })

  afterEach(() => {
    cleanup()
  })

  for (const { route, heading } of ROUTE_CASES) {
    it(`renders the main ${route} flow without crashing`, async () => {
      const queryClient = createTestQueryClient()

      render(
        <MemoryRouter initialEntries={[route]}>
          <I18nProvider>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </I18nProvider>
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(document.querySelector('main')).not.toBeNull()
      })
      const main = document.querySelector('main')
      expect(await within(main!).findByRole('heading', { name: heading })).toBeInTheDocument()
      expect(screen.queryByText(/Unhandled fetch in app smoke test/i)).not.toBeInTheDocument()
    })
  }
})
