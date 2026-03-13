export interface AppMeta {
  name: string
  stage: string
  version: string
  stack: {
    web: string
    api: string
    database: string
  }
  capabilities: string[]
}

export async function fetchAppMeta(): Promise<AppMeta> {
  const response = await fetch('/api/v1/meta')

  if (!response.ok) {
    throw new Error(`Failed to load app meta: ${response.status}`)
  }

  return response.json() as Promise<AppMeta>
}
