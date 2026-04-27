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
