import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import { createAppFetchMock, createStorageMock, createTestQueryClient } from './test/app-smoke-fixtures'

describe('dashboard saved valuation', () => {
  beforeEach(() => {
    const storage = createStorageMock()
    storage.setItem('portfolio.language', 'pl')
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(navigator, 'language', { value: 'pl-PL', configurable: true })
    Object.defineProperty(navigator, 'languages', { value: ['pl-PL'], configurable: true })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it.each([false, true])('keeps the dashboard visible during refresh and on failure (%s)', async (fails) => {
    const fallback = createAppFetchMock()
    const saved = await (await fallback('/api/v1/portfolio/overview')).json()
    saved.valuationSnapshot = {
      generatedAt: '2026-09-09T10:00:00Z', fromCache: true, refreshRequired: true,
    }
    let finish: (() => void) | undefined
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/portfolio/overview?preferCached=true')) {
        return new Response(JSON.stringify(saved), { status: 200 })
      }
      if (url.endsWith('/portfolio/overview')) {
        return new Promise<Response>((resolve) => {
          finish = () => resolve(new Response(JSON.stringify(fails
            ? { message: 'Upstream unavailable' }
            : { ...saved, totalCurrentValuePln: '11000.00', valuationSnapshot: {
              generatedAt: '2026-09-09T10:05:00Z', fromCache: false, refreshRequired: false,
            } }), { status: fails ? 503 : 200 }))
        })
      }
      return fallback(input)
    })
    const queryClient = createTestQueryClient()
    render(
      <MemoryRouter><I18nProvider><QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider></I18nProvider></MemoryRouter>,
    )
    expect(await screen.findByText(/Pokazujemy ostatnią poprawną wycenę/)).toBeInTheDocument()
    expect(screen.getByText(/Wycena obliczona/)).toBeInTheDocument()
    expect(screen.queryByText(/Budujemy aktualny obraz portfela/)).not.toBeInTheDocument()
    expect(queryClient.getQueryData<{ totalCurrentValuePln: string }>(['portfolio-overview'])?.totalCurrentValuePln).toBe('10550.00')
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    await act(async () => finish?.())
    if (fails) {
      expect(await screen.findByText(/Nie udało się odświeżyć wyceny/)).toBeInTheDocument()
      expect(screen.getByText(/Wycena obliczona/)).toBeInTheDocument()
    } else {
      await waitFor(() => expect(queryClient.getQueryData<{ totalCurrentValuePln: string }>(['portfolio-overview'])?.totalCurrentValuePln).toBe('11000.00'))
      expect(screen.queryByText(/Pokazujemy ostatnią poprawną wycenę/)).not.toBeInTheDocument()
    }
  })
})
