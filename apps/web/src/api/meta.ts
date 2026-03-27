import type { paths } from './generated/portfolio-api'
import { requestJson } from './http'

type GeneratedAppMeta =
  paths['/v1/meta']['get']['responses'][200]['content']['application/json']

export type AppMeta = GeneratedAppMeta & {
  stockAnalystUiUrl?: string | null
}

export function fetchAppMeta(): Promise<AppMeta> {
  return requestJson<AppMeta>('/api/v1/meta')
}
