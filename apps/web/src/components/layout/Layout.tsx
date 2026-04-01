import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUiLanguage } from '../../lib/i18n'
import { t } from '../../lib/messages'
import { QuickAddTransactionButton } from '../QuickAddTransactionButton'
import { Sidebar } from './Sidebar'
import { resolveRouteTitle } from './navigation'

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const mainRef = useRef<HTMLElement | null>(null)
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false)
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false)
  const isMobileNavMountedRef = useRef(false)
  const openAnimationFrameRef = useRef<number | null>(null)
  const previousPathRef = useRef(location.pathname)
  const currentTitle = resolveRouteTitle(location.pathname, getActiveUiLanguage())

  function openMobileNav() {
    isMobileNavMountedRef.current = true
    setIsMobileNavMounted(true)
  }

  function closeMobileNav() {
    if (openAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(openAnimationFrameRef.current)
      openAnimationFrameRef.current = null
    }
    setIsMobileNavVisible(false)
  }

  useEffect(() => {
    closeMobileNav()
  }, [location.pathname])

  useEffect(() => {
    const hash = location.hash.startsWith('#') ? decodeURIComponent(location.hash.slice(1)) : ''

    if (hash === '') {
      if (previousPathRef.current !== location.pathname) {
        if (typeof mainRef.current?.scrollTo === 'function') {
          mainRef.current.scrollTo({ top: 0, behavior: 'auto' })
        } else if (mainRef.current) {
          mainRef.current.scrollTop = 0
        }
      }
      previousPathRef.current = location.pathname
      return undefined
    }

    let attempts = 0
    let timeoutId: number | null = null

    const scrollToElement = (target: HTMLElement) => {
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'auto' })
      } else if (mainRef.current) {
        const top = target instanceof HTMLElement ? target.offsetTop : 0
        if (typeof mainRef.current.scrollTo === 'function') {
          mainRef.current.scrollTo({ top, behavior: 'auto' })
        } else {
          mainRef.current.scrollTop = top
        }
      }
    }

    const scrollToHashTarget = () => {
      const target = document.getElementById(hash)
      if (target) {
        scrollToElement(target)
        // Re-scroll after content settles (async data loading may shift layout)
        window.setTimeout(() => {
          const settled = document.getElementById(hash)
          if (settled) scrollToElement(settled)
        }, 600)
        previousPathRef.current = location.pathname
        return
      }

      if (attempts >= 40) {
        previousPathRef.current = location.pathname
        return
      }

      attempts += 1
      timeoutId = window.setTimeout(scrollToHashTarget, 50)
    }

    scrollToHashTarget()

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [location.pathname, location.hash])

  useEffect(() => {
    isMobileNavMountedRef.current = isMobileNavMounted
  }, [isMobileNavMounted])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isMobileNavMountedRef.current) {
        closeMobileNav()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!isMobileNavMounted) {
      return undefined
    }

    openAnimationFrameRef.current = window.requestAnimationFrame(() => {
      openAnimationFrameRef.current = null
      setIsMobileNavVisible(true)
    })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (openAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(openAnimationFrameRef.current)
        openAnimationFrameRef.current = null
      }
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileNavMounted])

  useEffect(() => {
    if (!isMobileNavMounted || isMobileNavVisible) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      isMobileNavMountedRef.current = false
      setIsMobileNavMounted(false)
    }, 200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isMobileNavMounted, isMobileNavVisible])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:flex lg:h-screen lg:overflow-hidden">
      <aside className="hidden border-r border-zinc-800 lg:flex lg:w-60 lg:shrink-0">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-0">
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur lg:hidden">
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              paddingTop: 'max(0.75rem, var(--safe-top))',
              paddingLeft: 'max(1rem, var(--safe-left))',
              paddingRight: 'max(1rem, var(--safe-right))',
            }}
          >
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              onClick={openMobileNav}
              aria-label={t('layout.openNavigation')}
              aria-expanded={isMobileNavVisible}
              aria-controls="mobile-navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 px-3">
              <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Portfolio</p>
              <p className="truncate text-sm font-semibold text-zinc-100">{currentTitle}</p>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div
            style={{
              paddingLeft: 'var(--safe-left)',
              paddingRight: 'var(--safe-right)',
              paddingBottom: 'var(--safe-bottom)',
            }}
          >
            <div className="mx-auto max-w-[100rem] p-4 sm:p-5 lg:p-8">{children}</div>
          </div>
        </main>
        <QuickAddTransactionButton />
      </div>

      {isMobileNavMounted && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
              isMobileNavVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeMobileNav}
            aria-hidden="true"
          />

          <aside
            id="mobile-navigation"
            className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[86vw] border-r border-zinc-800 bg-zinc-900 shadow-2xl transition-transform duration-200 ease-out lg:hidden ${
              isMobileNavVisible ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{
              paddingTop: 'var(--safe-top)',
              paddingBottom: 'var(--safe-bottom)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t('layout.navigation')}
          >
            <button
              onClick={closeMobileNav}
              className="absolute right-3 top-3 rounded-lg p-1 text-zinc-400 hover:text-zinc-200"
              aria-label={t('layout.closeNavigation')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
            <Sidebar onNavigate={closeMobileNav} />
          </aside>
        </>
      )}
    </div>
  )
}
