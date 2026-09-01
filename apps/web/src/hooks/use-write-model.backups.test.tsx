import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCreateTransaction, usePortfolioBackups } from './use-write-model'
import type { CreateTransactionPayload, PortfolioBackupStatus } from '../api/write-model'

describe('backup query coordination', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('polls while an automatic post-change backup is pending', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(backupStatus({ hasUnprotectedChanges: false })),
    )
    const queryClient = testQueryClient()
    queryClient.setQueryData(
      ['portfolio-backups'],
      backupStatus({ hasUnprotectedChanges: true }),
    )

    renderHook(() => usePortfolioBackups(), { wrapper: queryWrapper(queryClient) })

    expect(fetchSpy).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('polls quickly while a backup is running', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(backupStatus({ running: false })),
    )
    const queryClient = testQueryClient()
    queryClient.setQueryData(['portfolio-backups'], backupStatus({ running: true }))

    renderHook(() => usePortfolioBackups(), { wrapper: queryWrapper(queryClient) })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('polls a protected backup state at the slower baseline interval', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(backupStatus()),
    )
    const queryClient = testQueryClient()
    queryClient.setQueryData(['portfolio-backups'], backupStatus())

    renderHook(() => usePortfolioBackups(), { wrapper: queryWrapper(queryClient) })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999)
    })
    expect(fetchSpy).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('invalidates backup coverage after a canonical transaction mutation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ id: 'transaction-1' }))
    const queryClient = testQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { result } = renderHook(() => useCreateTransaction(), { wrapper: queryWrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync({
        accountId: 'account-1',
        type: 'DEPOSIT',
        tradeDate: '2026-09-01',
        grossAmount: '1000.00',
        currency: 'PLN',
      } as CreateTransactionPayload)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['portfolio-backups'] })
  })
})

function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function backupStatus(overrides: Partial<PortfolioBackupStatus> = {}): PortfolioBackupStatus {
  return {
    schedulerEnabled: true,
    directory: '/srv/portfolio/backups',
    intervalMinutes: 1440,
    retentionCount: 30,
    postChangeEnabled: true,
    postChangeDebounceSeconds: 120,
    postChangeMaxDelaySeconds: 600,
    postChangeRetentionCount: 10,
    safetyRetentionDays: 30,
    hasUnprotectedChanges: false,
    pendingSince: null,
    nextPostChangeBackupAt: null,
    running: false,
    lastRunAt: null,
    lastSuccessAt: '2026-09-01T10:00:00Z',
    lastFailureAt: null,
    lastFailureMessage: null,
    backups: [],
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
