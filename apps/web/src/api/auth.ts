import type { components, paths } from './generated/portfolio-api'
import { requestJson } from './http'

export type AuthSession =
  paths['/v1/auth/session']['get']['responses'][200]['content']['application/json']

export type CreateAuthSessionPayload =
  components['schemas']['CreateAuthSessionRequest']

export function fetchAuthSession() {
  return requestJson<AuthSession>('/api/v1/auth/session')
}

export function createAuthSession(payload: CreateAuthSessionPayload) {
  return requestJson<AuthSession>('/api/v1/auth/session', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteAuthSession() {
  return requestJson<AuthSession>('/api/v1/auth/session', {
    method: 'DELETE',
  })
}
