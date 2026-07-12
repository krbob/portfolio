import clsx from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUiLanguage } from '../../lib/i18n'
import { t } from '../../lib/messages'
import { IconClose, IconMenu } from '../ui/icons'
import { useDialogFocus } from '../ui/use-dialog-focus'
import { QuickAddTransactionButton } from '../QuickAddTransactionButton'
import { MarketDataStatusBar } from '../MarketDataStatusBar'
import { AppSwitcher } from '../AppSwitcher'
import { Sidebar } from './Sidebar'
import { resolveRouteTitle } from './navigation'

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const mainRef = useRef<HTMLElement | null>(null)
  const mobileNavRef = useRef<HTMLElement | null>(null)
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false)
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false)
  const openAnimationFrameRef = useRef<number | null>(null)
  const previousRouteRef = useRef(`${location.pathname}${location.search}`)
  const currentTitle = resolveRouteTitle(location.pathname, getActiveUiLanguage())

  function openMobileNav() {
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
    const currentRoute = `${location.pathname}${location.search}`
    const hash = location.hash.startsWith('#') ? decodeURIComponent(location.hash.slice(1)) : ''

    if (hash === '') {
      if (previousRouteRef.current !== currentRoute) {
        if (typeof mainRef.current?.scrollTo === 'function') {
          mainRef.current.scrollTo({ top: 0, behavior: 'auto' })
        } else if (mainRef.current) {
          mainRef.current.scrollTop = 0
        }
      }
      previousRouteRef.current = currentRoute
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
        previousRouteRef.current = currentRoute
        return
      }

      if (attempts >= 40) {
        previousRouteRef.current = currentRoute
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
  }, [location.pathname, location.search, location.hash])

  useDialogFocus(mobileNavRef, isMobileNavVisible, closeMobileNav)

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
      setIsMobileNavMounted(false)
    }, 200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isMobileNavMounted, isMobileNavVisible])

  return (
    <div className="min-h-screen bg-ui-canvas text-ui-text lg:flex lg:h-screen lg:overflow-hidden">
      <aside className="hidden border-r border-ui-border lg:flex lg:w-60 lg:shrink-0">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-0">
        <header className="sticky top-0 z-30 border-b border-ui-border bg-ui-canvas/95 backdrop-blur lg:hidden">
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-ui-control border border-ui-border bg-ui-surface text-ui-text-secondary transition-colors hover:border-ui-border-strong hover:text-ui-text"
              onClick={openMobileNav}
              aria-label={t('layout.openNavigation')}
              aria-expanded={isMobileNavVisible}
              aria-controls="mobile-navigation"
            >
              <IconMenu />
            </button>

            <div className="min-w-0 flex-1 px-3">
              <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-ui-text-muted">{t('layout.appName')}</p>
              <p className="truncate text-sm font-semibold text-ui-text">{currentTitle}</p>
            </div>

            <AppSwitcher compact />
          </div>
        </header>

        <MarketDataStatusBar />

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
            className={clsx(
              'fixed inset-0 z-40 bg-ui-canvas/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
              isMobileNavVisible ? 'opacity-100' : 'opacity-0',
            )}
            onClick={closeMobileNav}
            aria-hidden="true"
          />

          <aside
            ref={mobileNavRef}
            id="mobile-navigation"
            className={clsx(
              'fixed inset-y-0 left-0 z-50 w-72 max-w-[86vw] border-r border-ui-border bg-ui-surface shadow-2xl transition-transform duration-200 ease-out lg:hidden',
              isMobileNavVisible ? 'translate-x-0' : '-translate-x-full',
            )}
            style={{
              paddingTop: 'var(--safe-top)',
              paddingBottom: 'var(--safe-bottom)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t('layout.navigation')}
            aria-hidden={isMobileNavVisible ? undefined : true}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={closeMobileNav}
              className="absolute right-3 top-3 rounded-ui-control p-2 text-ui-text-muted hover:text-ui-text"
              aria-label={t('layout.closeNavigation')}
            >
              <IconClose />
            </button>
            <Sidebar onNavigate={closeMobileNav} />
          </aside>
        </>
      )}
    </div>
  )
}
