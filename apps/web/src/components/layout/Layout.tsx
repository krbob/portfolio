import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const currentTitle = resolveRouteTitle(location.pathname)

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileNavOpen])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:flex">
      <aside className="hidden border-r border-zinc-800 lg:flex lg:w-60 lg:shrink-0">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 px-3">
              <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Portfolio</p>
              <p className="truncate text-sm font-semibold text-zinc-100">{currentTitle}</p>
            </div>

            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400">
              SQLite
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-5 lg:p-8">{children}</div>
        </main>
      </div>

      {isMobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />

          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[86vw] border-r border-zinc-800 bg-zinc-900 shadow-2xl lg:hidden"
            aria-hidden="false"
          >
            <Sidebar onNavigate={() => setIsMobileNavOpen(false)} />
          </aside>
        </>
      )}
    </div>
  )
}

function resolveRouteTitle(pathname: string) {
  if (pathname === '/') {
    return 'Dashboard'
  }
  if (pathname.startsWith('/holdings')) {
    return 'Holdings'
  }
  if (pathname.startsWith('/performance') || pathname.startsWith('/returns') || pathname.startsWith('/charts')) {
    return 'Performance'
  }
  if (pathname.startsWith('/transactions')) {
    return 'Transactions'
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/data') || pathname.startsWith('/backups')) {
    return 'Settings'
  }
  return 'Portfolio'
}
