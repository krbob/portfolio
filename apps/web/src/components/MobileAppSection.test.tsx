import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileAppSection } from './MobileAppSection'
import { I18nProvider } from '../lib/i18n'

describe('MobileAppSection', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'pl-PL',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['pl-PL'],
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows push controls when the browser and API support notifications', async () => {
    const registration = createServiceWorkerRegistrationMock(null)
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => registration),
        register: vi.fn(async () => registration),
      },
    })
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn(async () => 'granted'),
      },
    })
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/v1/push/config')) {
        return new Response(
          JSON.stringify({
            enabled: true,
            vapidPublicKey: 'BElw-MockKey',
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unhandled fetch in mobile app section test: ${url}`)
    })

    render(
      <I18nProvider>
        <MobileAppSection />
      </I18nProvider>,
    )

    expect(await screen.findByText('Powiadomienia są gotowe do włączenia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /włącz/i })).toBeEnabled()
  })
})

function createServiceWorkerRegistrationMock(subscription: PushSubscription | null): ServiceWorkerRegistration {
  return {
    pushManager: {
      getSubscription: vi.fn(async () => subscription),
    },
  } as unknown as ServiceWorkerRegistration
}
