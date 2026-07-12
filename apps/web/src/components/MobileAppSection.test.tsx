import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

  it('sends the active UI locale when synchronizing an existing push subscription', async () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'en-GB',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['en-GB'],
    })
    const subscription = createPushSubscriptionMock()
    const registration = createServiceWorkerRegistrationMock(subscription)
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
        permission: 'granted',
        requestPermission: vi.fn(async () => 'granted'),
      },
    })
    let savedPayload: Record<string, unknown> | null = null
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/v1/push/config')) {
        return new Response(JSON.stringify({ enabled: true, vapidPublicKey: 'BElw-MockKey' }), { status: 200 })
      }
      if (url.includes('/api/v1/push/subscriptions') && init?.method === 'POST') {
        savedPayload = JSON.parse(String(init.body)) as Record<string, unknown>
        return new Response(
          JSON.stringify({
            endpoint: subscription.endpoint,
            locale: 'en',
            createdAt: '2026-07-13T10:00:00Z',
            updatedAt: '2026-07-13T10:00:00Z',
          }),
          { status: 201 },
        )
      }
      throw new Error(`Unhandled fetch in mobile app section test: ${url}`)
    })

    render(
      <I18nProvider>
        <MobileAppSection />
      </I18nProvider>,
    )

    await waitFor(() => expect(savedPayload).toMatchObject({ locale: 'en' }))
    expect(await screen.findByText('Notifications are enabled')).toBeInTheDocument()
  })
})

function createServiceWorkerRegistrationMock(subscription: PushSubscription | null): ServiceWorkerRegistration {
  return {
    pushManager: {
      getSubscription: vi.fn(async () => subscription),
    },
  } as unknown as ServiceWorkerRegistration
}

function createPushSubscriptionMock(): PushSubscription {
  return {
    endpoint: 'https://push.example.test/browser',
    expirationTime: null,
    options: {
      applicationServerKey: null,
      userVisibleOnly: true,
    },
    toJSON: () => ({
      endpoint: 'https://push.example.test/browser',
      expirationTime: null,
      keys: {
        p256dh: 'public-key',
        auth: 'auth-secret',
      },
    }),
    unsubscribe: vi.fn(async () => true),
  } as unknown as PushSubscription
}
