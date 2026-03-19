import type { paths } from './generated/portfolio-api'
import { requestJson } from './http'

export type AppReadiness =
  paths['/v1/readiness']['get']['responses'][200]['content']['application/json']

export function fetchAppReadiness(): Promise<AppReadiness> {
  return requestJson<AppReadiness>('/api/v1/readiness')
}
