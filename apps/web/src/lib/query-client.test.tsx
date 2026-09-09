import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppReadiness } from '../hooks/use-app-readiness'
import { usePortfolioDailyHistory, usePortfolioOverview } from '../hooks/use-read-model'
import { useAccounts } from '../hooks/use-write-model'
import { queryClient as applicationClient } from './query-client'

describe('browser query cache policy', () => {
  let client: QueryClient
  let now: number
  let calls: Record<string, number>

  beforeEach(() => {
    now = Date.parse('2026-09-09T10:00:00Z')
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    setVisibility('visible')
    onlineManager.setOnline(true)
    calls = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      calls[path] = (calls[path] ?? 0) + 1
      return new Response(JSON.stringify(path.endsWith('/accounts') ? [] : {}), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    client = new QueryClient({ defaultOptions: applicationClient.getDefaultOptions() })
  })

  afterEach(() => {
    cleanup()
    client.clear()
    vi.restoreAllMocks()
    setVisibility('visible')
    onlineManager.setOnline(true)
  })

  function mountQueries() {
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return renderHook(() => ({
      overview: usePortfolioOverview(),
      history: usePortfolioDailyHistory(),
      accounts: useAccounts(),
      readiness: useAppReadiness(),
    }), { wrapper })
  }

  async function waitForInitialData() {
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(Object.values(calls)).toEqual([1, 1, 1, 1])
  }

  async function returnAfter(milliseconds: number) {
    await act(async () => {
      setVisibility('hidden')
      now += milliseconds
      setVisibility('visible')
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('pageshow'))
    })
    await waitFor(() => expect(client.isFetching()).toBe(0))
  }

  it('keeps fresh data on a short return, then refreshes only the expired valuation', async () => {
    mountQueries()
    await waitForInitialData()
    await returnAfter(31_000)
    expect(Object.values(calls)).toEqual([1, 1, 1, 1])

    await returnAfter(30_000)
    expect(calls['/api/v1/portfolio/overview?preferCached=true']).toBe(2)
    expect(calls['/api/v1/portfolio/history/daily']).toBe(1)
    expect(calls['/api/v1/accounts']).toBe(1)
    expect(calls['/api/v1/readiness/details']).toBe(1)
  })

  it('refreshes expired history and settings after five minutes without duplicate resume requests', async () => {
    mountQueries()
    await waitForInitialData()
    await returnAfter(301_000)
    expect(Object.values(calls)).toEqual([2, 2, 2, 2])
  })

  it('uses the same freshness policy after reconnecting', async () => {
    mountQueries()
    await waitForInitialData()
    await act(async () => {
      onlineManager.setOnline(false)
      now += 61_000
      onlineManager.setOnline(true)
    })
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(calls['/api/v1/portfolio/overview?preferCached=true']).toBe(2)
    expect(calls['/api/v1/portfolio/history/daily']).toBe(1)
    expect(calls['/api/v1/accounts']).toBe(1)
    expect(calls['/api/v1/readiness/details']).toBe(1)
  })

  it('still honors explicit invalidation immediately while data is fresh', async () => {
    mountQueries()
    await waitForInitialData()
    await act(async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['portfolio-overview'] }),
        client.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
        client.invalidateQueries({ queryKey: ['accounts'] }),
      ])
    })
    expect(calls['/api/v1/portfolio/overview?preferCached=true']).toBe(2)
    expect(calls['/api/v1/portfolio/history/daily']).toBe(2)
    expect(calls['/api/v1/accounts']).toBe(2)
    expect(calls['/api/v1/readiness/details']).toBe(1)
  })
})

function setVisibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
  Object.defineProperty(document, 'hidden', { configurable: true, value: value === 'hidden' })
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
}
