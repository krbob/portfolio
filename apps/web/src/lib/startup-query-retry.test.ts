import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/http'
import {
  shouldRetryStartupQuery,
  STARTUP_QUERY_MAX_RETRIES,
  startupQueryRetryDelay,
} from './startup-query-retry'

describe('startup query retry policy', () => {
  it('retries boundedly for transport errors and server failures', () => {
    expect(shouldRetryStartupQuery(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetryStartupQuery(2, new ApiError('Unavailable', 503))).toBe(true)
    expect(shouldRetryStartupQuery(STARTUP_QUERY_MAX_RETRIES, new TypeError('Failed to fetch'))).toBe(false)
  })

  it('does not retry client errors or arbitrary application exceptions', () => {
    expect(shouldRetryStartupQuery(0, new ApiError('Unauthorized', 401))).toBe(false)
    expect(shouldRetryStartupQuery(0, new ApiError('Not found', 404))).toBe(false)
    expect(shouldRetryStartupQuery(0, new Error('Invalid response shape'))).toBe(false)
  })

  it('backs off quickly and caps the delay for a short deployment gap', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(startupQueryRetryDelay)).toEqual([
      500,
      1_000,
      2_000,
      4_000,
      5_000,
      5_000,
      5_000,
    ])
  })
})
