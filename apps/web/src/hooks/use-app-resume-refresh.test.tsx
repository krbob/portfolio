import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppResumeRefresh } from './use-app-resume-refresh'

function ResumeRefreshHarness() {
  useAppResumeRefresh()
  return null
}

describe('useAppResumeRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'))
    setDocumentVisibility(false)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('invalidates cached queries after the app returns from a longer pause', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <ResumeRefreshHarness />
      </QueryClientProvider>,
    )

    setDocumentVisibility(true)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(31_000)

    setDocumentVisibility(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate the refresh across resume events fired together', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <ResumeRefreshHarness />
      </QueryClientProvider>,
    )

    setDocumentVisibility(true)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(31_000)

    setDocumentVisibility(false)
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('clears short pauses so a later focus does not trigger a stale refresh', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <ResumeRefreshHarness />
      </QueryClientProvider>,
    )

    setDocumentVisibility(true)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(5_000)

    setDocumentVisibility(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(invalidateSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(40_000)
    window.dispatchEvent(new Event('focus'))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

function setDocumentVisibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: hidden ? 'hidden' : 'visible',
  })
}
