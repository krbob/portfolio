import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { I18nProvider } from './lib/i18n'
import { queryClient } from './lib/query-client'
import './app.css'

const PRELOAD_RELOAD_KEY = 'portfolio:preload-reload-at'

function shouldReloadAfterPreloadError() {
  const now = Date.now()

  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(PRELOAD_RELOAD_KEY) ?? 0)
    if (Number.isFinite(lastReloadAt) && now - lastReloadAt < 30_000) {
      return false
    }
    window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now))
  } catch {
    return true
  }

  return true
}

if (import.meta.env.PROD) {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()

    if (shouldReloadAfterPreloadError()) {
      window.location.reload()
    }
  })
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
