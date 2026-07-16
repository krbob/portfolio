import { expect, test } from '@playwright/test'

test('production app shell supports an offline deep-link with a query string @offline', async ({ context, page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Service worker did not claim the page.')), 10_000)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timeout)
        resolve()
      }, { once: true })
    })
  })

  await page.reload()
  await expect(page.locator('main')).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const cacheNames = await caches.keys()
    const cacheEntries = await Promise.all(cacheNames.map(async (cacheName) => {
      const cache = await caches.open(cacheName)
      return cache.keys()
    }))
    const paths = cacheEntries.flat().map((request) => new URL(request.url).pathname)
    return paths.some((path) => path.endsWith('.js')) && paths.some((path) => path.endsWith('.css'))
  })).toBe(true)

  await context.setOffline(true)
  try {
    const response = await page.goto('/performance?view=returns', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Portfolio/i)
    await expect(page.locator('main')).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('startup recovers from a transient online auth-session transport failure', async ({ page }) => {
  let authAttempts = 0
  await page.route('**/api/v1/auth/session', async (route) => {
    authAttempts += 1
    if (authAttempts === 1) {
      await route.abort('connectionfailed')
      return
    }
    await route.continue()
  })

  await page.goto('/')

  await expect.poll(() => authAttempts).toBeGreaterThan(1)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.getByText('Failed to fetch')).toHaveCount(0)
})
