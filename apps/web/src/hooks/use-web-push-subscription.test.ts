import { afterEach, describe, expect, it, vi } from 'vitest'
import { rememberPushLocaleForServiceWorker } from './use-web-push-subscription'

describe('push locale persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores the explicit UI locale for background subscription renewal', async () => {
    const put = vi.fn(async (_request: RequestInfo | URL, _response: Response) => undefined)
    const open = vi.fn(async () => ({ put }))
    vi.stubGlobal('caches', { open })

    await rememberPushLocaleForServiceWorker('en')

    expect(open).toHaveBeenCalledWith('portfolio-preferences-v1')
    expect(put).toHaveBeenCalledWith('/__portfolio/ui-locale', expect.any(Response))
    const response = put.mock.calls[0]?.[1]
    expect(await response?.text()).toBe('en')
  })
})
