import { useEffect, useMemo, useState } from 'react'
import { Card, SectionHeader } from './ui'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'

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
        title: t('mobile.installedTitle'),
        description: t('mobile.installedDescription'),
      }
    }

    return {
      title: t('mobile.availableTitle'),
      description: t('mobile.availableDescription'),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isPolish triggers re-translation via t()
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
        eyebrow={t('mobile.eyebrow')}
        title={t('mobile.sectionTitle')}
        description={t('mobile.sectionDescription')}
        actions={
          installPrompt ? (
            <button
              type="button"
              onClick={() => {
                void handleInstall()
              }}
              className="inline-flex items-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              {t('mobile.install')}
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
              {t('mobile.dismissed')}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
          <div>
            <p className="font-medium text-zinc-200">{t('mobile.howToInstall')}</p>
            <p className="mt-1 leading-6">
              {installPrompt
                ? t('mobile.installViaBrowser')
                : isIos
                  ? t('mobile.installViaIos')
                  : t('mobile.installViaMenu')}
            </p>
          </div>

          <div>
            <p className="font-medium text-zinc-200">{t('mobile.whatWorksOffline')}</p>
            <p className="mt-1 leading-6">
              {canRegisterServiceWorker
                ? t('mobile.offlineSupported')
                : t('mobile.offlineUnsupported')}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
