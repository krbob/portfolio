const CACHE_NAME = 'portfolio-shell-v2'
const APP_SHELL_PATHS = ['/', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.svg']

function shouldCacheResponse(url, response) {
  if (!response.ok) {
    return false
  }

  if (url.pathname.startsWith('/assets/')) {
    const contentType = response.headers.get('content-type') || ''
    return !contentType.includes('text/html')
  }

  return true
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_PATHS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put('/', response.clone()))
          }
          return response
        })
        .catch(async () => {
          const cachedShell = await caches.match('/')
          if (cachedShell) {
            return cachedShell
          }
          throw new Error('Offline shell is unavailable.')
        }),
    )
    return
  }

  const isStaticAsset = url.pathname.startsWith('/assets/') || APP_SHELL_PATHS.includes(url.pathname)
  if (!isStaticAsset) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(request).then((response) => {
        if (shouldCacheResponse(url, response)) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      })
    }),
  )
})

function parsePushPayload(event) {
  if (!event.data) {
    return {}
  }

  try {
    return event.data.json()
  } catch {
    return {
      body: event.data.text(),
    }
  }
}

self.addEventListener('push', (event) => {
  const data = parsePushPayload(event)
  const title = data.title || 'Portfolio'
  const options = {
    body: data.body || '',
    tag: data.tag || 'portfolio-alerts',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    data: {
      url: data.url || '/',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil((async () => {
    const rawTargetUrl = event.notification.data && event.notification.data.url
    const safeTargetUrl = resolveNotificationTarget(rawTargetUrl)
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })

    for (const client of windowClients) {
      const clientUrl = new URL(client.url)
      if (clientUrl.origin !== safeTargetUrl.origin || !('focus' in client)) {
        continue
      }

      await client.focus()
      if ('navigate' in client && client.url !== safeTargetUrl.href) {
        await client.navigate(safeTargetUrl.href)
      }
      return
    }

    if (clients.openWindow) {
      await clients.openWindow(safeTargetUrl.href)
    }
  })())
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(syncChangedPushSubscription(event).catch(() => undefined))
})

function resolveNotificationTarget(rawTargetUrl) {
  try {
    const targetUrl = new URL(rawTargetUrl || '/', self.location.origin)
    return targetUrl.origin === self.location.origin ? targetUrl : new URL('/', self.location.origin)
  } catch {
    return new URL('/', self.location.origin)
  }
}

async function syncChangedPushSubscription(event) {
  const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint
  if (oldEndpoint) {
    await deleteStoredPushSubscription(oldEndpoint)
  }

  const config = await fetchPushConfig()
  if (!config.enabled || !config.vapidPublicKey) {
    return
  }

  const subscription = event.newSubscription || await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
  })
  await savePushSubscription(subscription)
}

async function fetchPushConfig() {
  const response = await fetch('/api/v1/push/config', {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Push config failed with ${response.status}`)
  }
  return response.json()
}

async function savePushSubscription(subscription) {
  const payload = subscription.toJSON()
  payload.user_agent = self.navigator && self.navigator.userAgent ? self.navigator.userAgent : 'service-worker'
  const response = await fetch('/api/v1/push/subscriptions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Push subscription save failed with ${response.status}`)
  }
}

async function deleteStoredPushSubscription(endpoint) {
  const response = await fetch('/api/v1/push/subscriptions', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Push subscription delete failed with ${response.status}`)
  }
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = self.atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}
