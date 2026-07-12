import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPortfolioAlerts } from './read-model'

describe('portfolio alert locale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the explicit UI language instead of relying on the browser default', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchPortfolioAlerts('en')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/portfolio/alerts',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Accept-Language': 'en' }),
      }),
    )
  })
})
