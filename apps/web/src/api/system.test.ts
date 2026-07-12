import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAppReadiness } from './system'

describe('system readiness API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the authenticated diagnostics endpoint for the detailed UI', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: 'READY',
      checkedAt: '2026-07-12T00:00:00Z',
      checks: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchAppReadiness()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/readiness/details',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})
