import type { paths } from './generated/portfolio-api'
import { requestJson } from './http'

export type AppMeta =
  paths['/v1/meta']['get']['responses'][200]['content']['application/json']

export function fetchAppMeta(): Promise<AppMeta> {
  return requestJson<AppMeta>('/api/v1/meta')
}
