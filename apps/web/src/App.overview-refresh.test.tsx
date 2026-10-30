import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import { formatCurrencyPln, formatSignedCurrencyPln } from './lib/format'
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

  it.each([false, true])('shows headline values before slow analytics finish (saved preview: %s)', async (savedPreview) => {
    const fallback = createAppFetchMock()
    const overview = await (await fallback('/api/v1/portfolio/overview')).json()
    overview.totalPreviousCloseValuePln = '10400.00'
    overview.valuationSnapshot = {
      generatedAt: '2026-09-09T10:00:00Z', fromCache: savedPreview, refreshRequired: savedPreview,
    }
    const analyticsPaths = ['/history/daily', '/returns', '/allocation', '/alerts']
    const requestedAnalytics = new Set<string>()
    const pending: Array<() => void> = []
    let finishOverview: (() => void) | undefined
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/portfolio/overview?preferCached=true')) {
        return new Promise<Response>((resolve) => {
          finishOverview = () => resolve(new Response(JSON.stringify(overview)))
        })
      }
      const analyticsPath = analyticsPaths.find((path) => url.includes(`/portfolio${path}`))
      if (analyticsPath || url.endsWith('/portfolio/overview')) {
        if (analyticsPath) requestedAnalytics.add(analyticsPath)
        return new Promise<Response>((resolve) => {
          pending.push(() => void fallback(input).then(resolve))
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
    await waitFor(() => expect(finishOverview).toBeTypeOf('function'))
    expect(requestedAnalytics.size).toBe(0)

    await act(async () => finishOverview?.())
    expect(await screen.findByText(formatCurrencyPln('10550.00'), { normalizer: (value) => value })).toBeInTheDocument()
    expect(screen.getByText(formatSignedCurrencyPln(150), { normalizer: (value) => value })).toBeInTheDocument()
    await waitFor(() => expect([...requestedAnalytics].sort()).toEqual([...analyticsPaths].sort()))
    expect(queryClient.getQueryData(['portfolio-daily-history'])).toBeUndefined()
    expect(queryClient.getQueryData(['portfolio-returns'])).toBeUndefined()
    if (savedPreview) {
      await userEvent.click(screen.getByRole('button', { name: 'Aktualność danych' }))
      expect(screen.getByText(/Pokazujemy ostatnią poprawną wycenę/)).toBeInTheDocument()
    }
    await act(async () => pending.forEach((finish) => finish()))
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
    await userEvent.click(await screen.findByRole('button', { name: 'Aktualność danych' }))
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
