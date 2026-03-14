export const API_UNAUTHORIZED_EVENT = 'portfolio:unauthorized'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export class ApiUnauthorizedError extends ApiError {
  constructor(message: string) {
    super(message, 401)
  }
}

interface RequestJsonOptions extends RequestInit {
  contentType?: string | null
}

export async function requestJson<T>(path: string, init: RequestJsonOptions = {}): Promise<T> {
  const response = await request(path, init)
  return response.json() as Promise<T>
}

export async function requestEmpty(path: string, init: RequestJsonOptions = {}): Promise<void> {
  await request(path, init)
}

export async function requestResponse(path: string, init: RequestJsonOptions = {}): Promise<Response> {
  return request(path, init)
}

async function request(path: string, init: RequestJsonOptions): Promise<Response> {
  const { contentType = init.body ? 'application/json' : null, headers, ...rest } = init
  const response = await fetch(path, {
    credentials: 'include',
    ...rest,
    headers: {
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(headers ?? {}),
    },
  })

  if (response.ok) {
    return response
  }

  const message = await extractErrorMessage(response)
  if (response.status === 401) {
    window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT))
    throw new ApiUnauthorizedError(message)
  }

  throw new ApiError(message, response.status)
}

async function extractErrorMessage(response: Response) {
  let message = `Request failed with status ${response.status}`

  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) {
      message = body.message
    }
  } catch {
    // Keep generic fallback.
  }

  return message
}
