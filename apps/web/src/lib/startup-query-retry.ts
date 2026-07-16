import { ApiError } from '../api/http'

export const STARTUP_QUERY_MAX_RETRIES = 7

export function shouldRetryStartupQuery(failureCount: number, error: unknown) {
  if (failureCount >= STARTUP_QUERY_MAX_RETRIES) {
    return false
  }

  return error instanceof TypeError || (error instanceof ApiError && error.status >= 500)
}

export function startupQueryRetryDelay(attemptIndex: number) {
  return Math.min(500 * (2 ** attemptIndex), 5_000)
}
