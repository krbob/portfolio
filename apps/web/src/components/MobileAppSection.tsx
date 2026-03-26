import { useEffect, useMemo, useState } from 'react'
import { Card, SectionHeader } from './ui'
import { useI18n } from '../lib/i18n'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function MobileAppSection() {
  const { isPolish } = useI18n()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installResult, setInstallResult] = useState<'accepted' | 'dismissed' | null>(null)

  const canRegisterServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null
    const updateStandalone = () => {
      const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
      setIsStandalone(Boolean(mediaQuery?.matches || navigatorWithStandalone.standalone))
    }

    updateStandalone()

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallResult(null)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setInstallResult('accepted')
      updateStandalone()
    }

    mediaQuery?.addEventListener?.('change', updateStandalone)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      mediaQuery?.removeEventListener?.('change', updateStandalone)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const status = useMemo(() => {
    if (isStandalone) {
      return {
        title: isPolish ? 'Aplikacja jest zainstalowana' : 'App is installed',
        description: isPolish
          ? 'Portfolio działa teraz jak osobna aplikacja uruchamiana z ekranu głównego.'
          : 'Portfolio is running in an app-like standalone mode.',
      }
    }

    return {
      title: isPolish ? 'Możesz dodać aplikację do ekranu głównego' : 'You can install this app',
      description: isPolish
        ? 'Po dodaniu do ekranu głównego aplikacja szybciej otwiera interfejs na telefonie, ale bieżące dane portfela nadal wymagają połączenia z API.'
        : 'Installing the app keeps the shell handy on mobile, but live portfolio data still requires API connectivity.',
    }
  }, [isPolish, isStandalone])

  async function handleInstall() {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallResult(choice.outcome)
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  return (
    <Card as="section">
      <SectionHeader
        eyebrow={isPolish ? 'Aplikacja' : 'App'}
        title={isPolish ? 'Instalacja na telefonie' : 'Install on mobile'}
        description={isPolish
          ? 'Portfolio możesz dodać do ekranu głównego telefonu, aby szybciej wracać do aplikacji i korzystać z prostszego trybu pełnoekranowego.'
          : 'Portfolio supports a lightweight PWA flow, so you can pin it to your home screen and reopen a cached app shell faster.'}
        actions={
          installPrompt ? (
            <button
              type="button"
              onClick={() => {
                void handleInstall()
              }}
              className="inline-flex items-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              {isPolish ? 'Zainstaluj' : 'Install'}
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-sm font-semibold text-zinc-100">{status.title}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{status.description}</p>
          {installResult === 'dismissed' && (
            <p className="mt-3 text-xs text-zinc-500">
              {isPolish
                ? 'Okno instalacji zostało zamknięte. Możesz wrócić do tej sekcji później.'
                : 'The install prompt was dismissed. You can come back to this section later.'}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
          <div>
            <p className="font-medium text-zinc-200">{isPolish ? 'Jak zainstalować' : 'How to install'}</p>
            <p className="mt-1 leading-6">
              {installPrompt
                ? isPolish
                  ? 'Na tej przeglądarce możesz użyć przycisku instalacji powyżej.'
                  : 'This browser can install the app directly with the button above.'
                : isIos
                  ? isPolish
                    ? 'Na iPhonie lub iPadzie użyj Udostępnij, a potem Dodaj do ekranu głównego.'
                    : 'On iPhone or iPad, use Share and then Add to Home Screen.'
                  : isPolish
                    ? 'Jeśli przeglądarka nie pokazuje okna instalacji, użyj jej menu i wybierz opcję dodania aplikacji.'
                    : 'If the browser does not show an install prompt, use its menu and choose the install option.'}
            </p>
          </div>

          <div>
            <p className="font-medium text-zinc-200">{isPolish ? 'Co działa offline' : 'What works offline'}</p>
            <p className="mt-1 leading-6">
              {canRegisterServiceWorker
                ? isPolish
                  ? 'Manifest, ikony i ostatnio zapisany interfejs są zapisywane lokalnie po pierwszej wizycie. Dane portfela nadal są pobierane na żywo z API.'
                  : 'The manifest, icons and last loaded app shell are cached after the first visit. Portfolio data is still fetched live from the API.'
                : isPolish
                  ? 'Ta przeglądarka nie obsługuje mechanizmu offline, więc aplikacja działa wyłącznie online.'
                  : 'This browser does not expose a service worker, so the app remains online-only.'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
