import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMarketDataSnapshots, usePortfolioOverview } from './use-read-model'

describe('read-model query coordination', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches active market-data diagnostics after overview refreshes upstream quotes', async () => {
    let finishOverview: (() => void) | undefined
    let snapshotRequests = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
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
      const url = String(input)
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
