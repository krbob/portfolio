import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  useMarketDataSnapshots, usePortfolioAccounts, usePortfolioAllocation,
  usePortfolioDailyHistory, usePortfolioHoldings, usePortfolioOverview, usePortfolioReturns,
} from './use-read-model'

describe('read-model query coordination', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it.each([false, true])('shows a saved valuation during a slow refresh and preserves it on failure (%s)', async (failRefresh) => {
    let finishRefresh: (() => void) | undefined
    const saved = {
      totalCurrentValuePln: '100.00',
      valuationSnapshot: { generatedAt: '2026-09-09T10:00:00Z', fromCache: true, refreshRequired: true },
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('preferCached=true')) return jsonResponse(saved)
      return new Promise<Response>((resolve, reject) => {
        finishRefresh = () => failRefresh
          ? reject(new Error('Upstream unavailable'))
          : resolve(jsonResponse({ ...saved, totalCurrentValuePln: '120.00', valuationSnapshot: {
            generatedAt: '2026-09-09T10:05:00Z', fromCache: false, refreshRequired: false,
          } }))
      })
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePortfolioOverview(), { wrapper })
    await waitFor(() => {
      expect(result.current.data?.totalCurrentValuePln).toBe('100.00')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isFetching).toBe(true)
      expect(finishRefresh).toBeTypeOf('function')
    })
    act(() => finishRefresh?.())
    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
      expect(result.current.isError).toBe(failRefresh)
      expect(result.current.data?.totalCurrentValuePln).toBe(failRefresh ? '100.00' : '120.00')
    })
    expect(result.current.data?.valuationSnapshot?.generatedAt).toBe(
      failRefresh ? '2026-09-09T10:00:00Z' : '2026-09-09T10:05:00Z',
    )
  })

  it('does not restore a cancelled preview after clearing the session query cache', async () => {
    let finishPreview: (() => void) | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('preferCached=true')) {
        return new Promise<Response>((resolve) => {
          finishPreview = () => resolve(jsonResponse({ totalCurrentValuePln: '100.00', valuationSnapshot: {
            generatedAt: '2026-09-09T10:00:00Z', fromCache: true, refreshRequired: true,
          } }))
        })
      }
      expect(init?.signal?.aborted).toBe(true)
      throw new DOMException('Aborted', 'AbortError')
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { unmount } = renderHook(() => usePortfolioOverview(), { wrapper })
    await waitFor(() => expect(finishPreview).toBeTypeOf('function'))
    unmount()
    client.clear()
    await act(async () => finishPreview?.())
    expect(client.getQueryData(['portfolio-overview'])).toBeUndefined()
  })

  it.each([false, true])('reads diagnostics once after six overlapping reads settle (last fails: %s)', async (lastFails) => {
    const finish = new Map<string, () => void>()
    let snapshotRequests = 0
    let finished = false
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input).split('?')[0].split('/portfolio/')[1]
      if (path === 'market-data-snapshots') {
        snapshotRequests++
        return jsonResponse([{
          ...quoteSnapshot('FRESH'),
          status: finished && !lastFails ? 'FRESH' : 'FAILED',
        }])
      }
      return new Promise<Response>((resolve, reject) => {
        finish.set(path, () => {
          if (path === 'returns') {
            finished = true
            if (lastFails) {
              reject(new Error('Upstream unavailable'))
              return
            }
          }
          resolve(jsonResponse({}))
        })
      })
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => ({
      overview: usePortfolioOverview(),
      holdings: usePortfolioHoldings(),
      accounts: usePortfolioAccounts(),
      allocation: usePortfolioAllocation(),
      history: usePortfolioDailyHistory(),
      returns: usePortfolioReturns(),
      snapshots: useMarketDataSnapshots(),
    }), { wrapper })
    await waitFor(() => expect(result.current.snapshots.isSuccess).toBe(true))

    act(() => {
      for (const [path, complete] of finish) if (path !== 'returns') complete()
    })
    await waitFor(() => {
      expect(result.current.overview.isSuccess).toBe(true)
      expect(result.current.holdings.isSuccess).toBe(true)
      expect(result.current.accounts.isSuccess).toBe(true)
      expect(result.current.allocation.isSuccess).toBe(true)
      expect(result.current.history.isSuccess).toBe(true)
    })
    expect(snapshotRequests).toBe(1)

    act(() => finish.get('returns')?.())
    await waitFor(() => {
      expect(result.current.returns.isError).toBe(lastFails)
      expect(result.current.returns.isSuccess).toBe(!lastFails)
      expect(snapshotRequests).toBe(2)
      expect(result.current.snapshots.isFetching).toBe(false)
      expect(result.current.snapshots.data?.[0]?.status).toBe(lastFails ? 'FAILED' : 'FRESH')
    })
  })

  it.each([
    ['history/daily', usePortfolioDailyHistory],
    ['returns', usePortfolioReturns],
  ] as const)('updates diagnostics when %s repairs history after overview has finished', async (path, useAnalytics) => {
    let finishAnalytics: (() => void) | undefined
    let repaired = false
    let snapshotRequests = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input).split('?')[0]
      if (url.endsWith('/portfolio/overview')) return jsonResponse({ totalCurrentValuePln: '100.00' })
      if (url.endsWith(`/portfolio/${path}`)) {
        return new Promise<Response>((resolve) => {
          finishAnalytics = () => {
            repaired = true
            resolve(jsonResponse({}))
          }
        })
      }
      if (url.endsWith('/portfolio/market-data-snapshots')) {
        snapshotRequests++
        return jsonResponse([{
          ...quoteSnapshot('FRESH'),
          identity: 'stock-history:VWRA.L',
          status: repaired ? 'FRESH' : 'FAILED',
        }])
      }
      throw new Error(`Unexpected request: ${url}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => ({
      overview: usePortfolioOverview(),
      analytics: useAnalytics(),
      snapshots: useMarketDataSnapshots(),
    }), { wrapper })

    await waitFor(() => {
      expect(result.current.overview.isSuccess).toBe(true)
      expect(result.current.snapshots.data?.[0]?.status).toBe('FAILED')
      expect(result.current.snapshots.isFetching).toBe(false)
    })
    const requestsBeforeRepair = snapshotRequests
    act(() => finishAnalytics?.())

    await waitFor(() => {
      expect(result.current.analytics.isSuccess).toBe(true)
      expect(result.current.snapshots.data?.[0]?.status).toBe('FRESH')
    })
    expect(snapshotRequests).toBeGreaterThan(requestsBeforeRepair)
  })

  it('refetches active market-data diagnostics after overview refreshes upstream quotes', async () => {
    let finishOverview: (() => void) | undefined
    let snapshotRequests = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input).split('?')[0]
      if (url.endsWith('/api/v1/portfolio/overview')) {
        return new Promise<Response>((resolve) => {
          finishOverview = () => resolve(jsonResponse({ totalCurrentValuePln: '100.00' }))
        })
      }
      if (url.endsWith('/api/v1/portfolio/market-data-snapshots')) {
        snapshotRequests += 1
        return jsonResponse([quoteSnapshot(snapshotRequests === 1 ? 'PARTIAL' : 'FRESH')])
      }
      throw new Error(`Unexpected request: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => ({
      overview: usePortfolioOverview(),
      snapshots: useMarketDataSnapshots(),
    }), { wrapper })

    await waitFor(() => {
      expect(result.current.snapshots.data?.[0]?.provenance?.status).toBe('PARTIAL')
    })

    act(() => finishOverview?.())

    await waitFor(() => {
      expect(result.current.overview.isSuccess).toBe(true)
      expect(result.current.snapshots.data?.[0]?.provenance?.status).toBe('FRESH')
    })
    expect(snapshotRequests).toBe(2)
  })

  it('cancels a racing diagnostics request before reading the post-overview state', async () => {
    let finishOverview: (() => void) | undefined
    let firstSnapshotSignal: AbortSignal | undefined
    let snapshotRequests = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input).split('?')[0]
      if (url.endsWith('/api/v1/portfolio/overview')) {
        return new Promise<Response>((resolve) => {
          finishOverview = () => resolve(jsonResponse({ totalCurrentValuePln: '100.00' }))
        })
      }
      if (url.endsWith('/api/v1/portfolio/market-data-snapshots')) {
        snapshotRequests += 1
        if (snapshotRequests === 1) {
          firstSnapshotSignal = init?.signal ?? undefined
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }, { once: true })
          })
        }
        return jsonResponse([quoteSnapshot('FRESH')])
      }
      throw new Error(`Unexpected request: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => ({
      overview: usePortfolioOverview(),
      snapshots: useMarketDataSnapshots(),
    }), { wrapper })

    await waitFor(() => {
      expect(snapshotRequests).toBe(1)
      expect(finishOverview).toBeTypeOf('function')
    })
    act(() => finishOverview?.())

    await waitFor(() => {
      expect(firstSnapshotSignal?.aborted).toBe(true)
      expect(result.current.snapshots.data?.[0]?.provenance?.status).toBe('FRESH')
    })
    expect(snapshotRequests).toBe(2)
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function quoteSnapshot(status: 'FRESH' | 'PARTIAL') {
  return {
    snapshotType: 'QUOTE',
    identity: 'stock-quote:VWRA.L',
    cachedAt: '2026-07-18T08:00:00Z',
    status: 'FRESH',
    lastCheckedAt: '2026-07-18T08:00:00Z',
    failureCount: 0,
    provenance: {
      source: 'YAHOO_FINANCE',
      retrievedAt: '2026-07-18T08:00:00Z',
      marketDate: '2026-07-17',
      currency: 'PLN',
      unitScale: 1,
      adjustment: 'SPLIT_ADJUSTED',
      status,
    },
  }
}
