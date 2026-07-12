import { useEffect, useMemo, useState } from 'react'
import { useWebPushSubscription, type WebPushStatus } from '../hooks/use-web-push-subscription'
import { Card, SectionHeader } from './ui'
import { useI18n } from '../lib/i18n'
import { t } from '../lib/messages'
import { btnPrimary, btnSecondary } from '../lib/styles'
import { IconBell } from './ui/icons'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function MobileAppSection() {
  const { language } = useI18n()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installResult, setInstallResult] = useState<'accepted' | 'dismissed' | null>(null)
  const webPush = useWebPushSubscription({ isStandalone })

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- language triggers re-translation via t()
  }, [language, isStandalone])

  const notificationStatus = useMemo(
    () => notificationStatusCopy(webPush.status),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- language triggers re-translation via t()
    [language, webPush.status],
  )

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
            <p className="mt-3 text-xs text-zinc-400">
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

          <div className="border-t border-zinc-800 pt-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-zinc-200">{t('mobile.notificationsTitle')}</p>
                <p className="mt-2 text-sm font-medium text-zinc-100">{notificationStatus.title}</p>
                <p className="mt-1 leading-6">{notificationStatus.description}</p>
                {webPush.errorMessage && (
                  <p className="mt-2 text-xs text-red-300">{webPush.errorMessage}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  void webPush.toggle()
                }}
                disabled={!canToggleNotifications(webPush.status)}
                className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start ${webPush.enabled ? btnSecondary : btnPrimary}`}
                title={notificationStatus.title}
              >
                <IconBell className="h-4 w-4" />
                {webPush.enabled ? t('mobile.notificationsDisable') : notificationStatus.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function canToggleNotifications(status: WebPushStatus) {
  return status === 'off' || status === 'on' || status === 'error'
}

function notificationStatusCopy(status: WebPushStatus) {
  switch (status) {
    case 'checking':
      return {
        title: t('mobile.notificationsCheckingTitle'),
        description: t('mobile.notificationsCheckingDescription'),
        buttonLabel: t('mobile.notificationsCheckingButton'),
      }
    case 'install-required':
      return {
        title: t('mobile.notificationsInstallRequiredTitle'),
        description: t('mobile.notificationsInstallRequiredDescription'),
        buttonLabel: t('mobile.notificationsEnable'),
      }
    case 'server-disabled':
      return {
        title: t('mobile.notificationsServerDisabledTitle'),
        description: t('mobile.notificationsServerDisabledDescription'),
        buttonLabel: t('mobile.notificationsEnable'),
      }
    case 'blocked':
      return {
        title: t('mobile.notificationsBlockedTitle'),
        description: t('mobile.notificationsBlockedDescription'),
        buttonLabel: t('mobile.notificationsEnable'),
      }
    case 'off':
      return {
        title: t('mobile.notificationsOffTitle'),
        description: t('mobile.notificationsOffDescription'),
        buttonLabel: t('mobile.notificationsEnable'),
      }
    case 'on':
      return {
        title: t('mobile.notificationsOnTitle'),
        description: t('mobile.notificationsOnDescription'),
        buttonLabel: t('mobile.notificationsDisable'),
      }
    case 'pending':
      return {
        title: t('mobile.notificationsPendingTitle'),
        description: t('mobile.notificationsPendingDescription'),
        buttonLabel: t('mobile.notificationsPendingButton'),
      }
    case 'error':
      return {
        title: t('mobile.notificationsErrorTitle'),
        description: t('mobile.notificationsErrorDescription'),
        buttonLabel: t('common.retry'),
      }
    case 'unsupported':
    default:
      return {
        title: t('mobile.notificationsUnsupportedTitle'),
        description: t('mobile.notificationsUnsupportedDescription'),
        buttonLabel: t('mobile.notificationsEnable'),
      }
  }
}
