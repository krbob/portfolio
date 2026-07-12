import type { paths } from './generated/portfolio-api'
import { requestEmpty, requestJson } from './http'

export type WebPushConfig =
  paths['/v1/push/config']['get']['responses'][200]['content']['application/json']

type GeneratedWebPushSubscriptionPayload =
  NonNullable<paths['/v1/push/subscriptions']['post']['requestBody']>['content']['application/json']

export type WebPushSubscriptionPayload = GeneratedWebPushSubscriptionPayload & {
  locale?: 'pl' | 'en'
}

export type WebPushSubscriptionResponse =
  paths['/v1/push/subscriptions']['post']['responses'][201]['content']['application/json']

export function fetchWebPushConfig() {
  return requestJson<WebPushConfig>('/api/v1/push/config')
}

export function saveWebPushSubscription(payload: WebPushSubscriptionPayload) {
  return requestJson<WebPushSubscriptionResponse>('/api/v1/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteWebPushSubscription(endpoint: string) {
  return requestEmpty('/api/v1/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
}
