import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteWebPushSubscription,
  fetchWebPushConfig,
  saveWebPushSubscription,
  type WebPushConfig,
  type WebPushSubscriptionPayload,
} from '../api/push'
import { useI18n, type UiLanguage } from '../lib/i18n'

export type WebPushStatus =
  | 'checking'
  | 'unsupported'
  | 'install-required'
  | 'server-disabled'
  | 'blocked'
  | 'off'
  | 'on'
  | 'pending'
  | 'error'

interface UseWebPushSubscriptionOptions {
  isStandalone: boolean
}

interface WebPushState {
  status: WebPushStatus
  enabled: boolean
  serverEnabled: boolean
  errorMessage: string | null
}

const CHECKING_STATE: WebPushState = {
  status: 'checking',
  enabled: false,
  serverEnabled: false,
  errorMessage: null,
}

function isIosDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function detectUnsupportedStatus(isStandalone: boolean): WebPushStatus | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unsupported'
  }

  if (isIosDevice() && !isStandalone) {
    return 'install-required'
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }

  return null
}

function pushConfigEnabled(config: WebPushConfig) {
  return Boolean(config.enabled && config.vapidPublicKey)
}

async function ensureServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration('/')
  if (existingRegistration) {
    return existingRegistration
  }

  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

function subscriptionUsesVapidKey(subscription: PushSubscription, vapidPublicKey: string) {
  const currentKey = subscription.options.applicationServerKey
  if (!currentKey) {
    return true
  }

  const expectedKey = urlBase64ToUint8Array(vapidPublicKey)
  const actualKey = new Uint8Array(currentKey)
  if (actualKey.length !== expectedKey.length) {
    return false
  }

  return expectedKey.every((value, index) => actualKey[index] === value)
}

function toSubscriptionPayload(
  subscription: PushSubscription,
  locale: UiLanguage,
): WebPushSubscriptionPayload {
  const subscriptionJson = subscription.toJSON()
  const endpoint = subscriptionJson.endpoint ?? subscription.endpoint
  const p256dh = subscriptionJson.keys?.p256dh
  const auth = subscriptionJson.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing endpoint or encryption keys.')
  }

  return {
    endpoint,
    expirationTime: subscriptionJson.expirationTime ?? null,
    keys: {
      p256dh,
      auth,
    },
    user_agent: navigator.userAgent,
    locale,
  }
}

export function useWebPushSubscription({ isStandalone }: UseWebPushSubscriptionOptions) {
  const { language } = useI18n()
  const [state, setState] = useState<WebPushState>(CHECKING_STATE)
  const [config, setConfig] = useState<WebPushConfig | null>(null)

  const sync = useCallback(async () => {
    const unsupportedStatus = detectUnsupportedStatus(isStandalone)
    if (unsupportedStatus) {
      setState({
        status: unsupportedStatus,
        enabled: false,
        serverEnabled: false,
        errorMessage: null,
      })
      return
    }

    setState((current) => ({
      ...current,
      status: current.status === 'on' ? 'on' : 'checking',
      errorMessage: null,
    }))

    try {
      const nextConfig = await fetchWebPushConfig()
      setConfig(nextConfig)

      if (!pushConfigEnabled(nextConfig)) {
        setState({
          status: 'server-disabled',
          enabled: false,
          serverEnabled: false,
          errorMessage: null,
        })
        return
      }

      if (Notification.permission === 'denied') {
        setState({
          status: 'blocked',
          enabled: false,
          serverEnabled: true,
          errorMessage: null,
        })
        return
      }

      const registration = await ensureServiceWorkerRegistration()
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        if (nextConfig.vapidPublicKey && !subscriptionUsesVapidKey(subscription, nextConfig.vapidPublicKey)) {
          const endpoint = subscription.endpoint
          await subscription.unsubscribe()
          await deleteWebPushSubscription(endpoint)
          setState({
            status: 'off',
            enabled: false,
            serverEnabled: true,
            errorMessage: null,
          })
          return
        }
        await saveWebPushSubscription(toSubscriptionPayload(subscription, language))
      }

      setState({
        status: subscription ? 'on' : 'off',
        enabled: Boolean(subscription),
        serverEnabled: true,
        errorMessage: null,
      })
    } catch (error) {
      setState({
        status: 'error',
        enabled: false,
        serverEnabled: false,
        errorMessage: error instanceof Error ? error.message : 'Web push setup failed.',
      })
    }
  }, [isStandalone, language])

  useEffect(() => {
    void sync()
  }, [sync])

  const enable = useCallback(async () => {
    const unsupportedStatus = detectUnsupportedStatus(isStandalone)
    if (unsupportedStatus) {
      setState({
        status: unsupportedStatus,
        enabled: false,
        serverEnabled: false,
        errorMessage: null,
      })
      return
    }

    setState((current) => ({
      ...current,
      status: 'pending',
      errorMessage: null,
    }))

    try {
      const nextConfig = config ?? await fetchWebPushConfig()
      setConfig(nextConfig)

      if (!pushConfigEnabled(nextConfig) || !nextConfig.vapidPublicKey) {
        setState({
          status: 'server-disabled',
          enabled: false,
          serverEnabled: false,
          errorMessage: null,
        })
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState({
          status: permission === 'denied' ? 'blocked' : 'off',
          enabled: false,
          serverEnabled: true,
          errorMessage: null,
        })
        return
      }

      const registration = await ensureServiceWorkerRegistration()
      let subscription = await registration.pushManager.getSubscription()
      if (subscription && !subscriptionUsesVapidKey(subscription, nextConfig.vapidPublicKey)) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await deleteWebPushSubscription(endpoint)
        subscription = null
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(nextConfig.vapidPublicKey),
      })

      await saveWebPushSubscription(toSubscriptionPayload(subscription, language))
      setState({
        status: 'on',
        enabled: true,
        serverEnabled: true,
        errorMessage: null,
      })
    } catch (error) {
      setState({
        status: 'error',
        enabled: false,
        serverEnabled: false,
        errorMessage: error instanceof Error ? error.message : 'Web push setup failed.',
      })
    }
  }, [config, isStandalone, language])

  const disable = useCallback(async () => {
    const unsupportedStatus = detectUnsupportedStatus(isStandalone)
    if (unsupportedStatus) {
      setState({
        status: unsupportedStatus,
        enabled: false,
        serverEnabled: false,
        errorMessage: null,
      })
      return
    }

    setState((current) => ({
      ...current,
      status: 'pending',
      errorMessage: null,
    }))

    try {
      const registration = await ensureServiceWorkerRegistration()
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await deleteWebPushSubscription(endpoint)
      }

      setState({
        status: 'off',
        enabled: false,
        serverEnabled: true,
        errorMessage: null,
      })
    } catch (error) {
      setState({
        status: 'error',
        enabled: false,
        serverEnabled: false,
        errorMessage: error instanceof Error ? error.message : 'Web push disable failed.',
      })
    }
  }, [isStandalone])

  const toggle = useCallback(async () => {
    if (state.enabled) {
      await disable()
    } else {
      await enable()
    }
  }, [disable, enable, state.enabled])

  return useMemo(() => ({
    ...state,
    refresh: sync,
    toggle,
  }), [state, sync, toggle])
}
