import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppMeta } from '../hooks/use-app-meta'
import { useAuthSession } from '../hooks/use-auth-session'
import { createStorageMock } from '../test/app-smoke-fixtures'
import { AuthGate } from './AuthGate'

vi.mock('../hooks/use-app-meta', () => ({ useAppMeta: vi.fn() }))
vi.mock('../hooks/use-auth-session', () => ({ useAuthSession: vi.fn(), useLogin: vi.fn() }))

const meta = {
  name: 'Portfolio',
  stage: 'test',
  version: '1.0.0',
  auth: { enabled: false, mode: 'DISABLED' },
  stack: { web: 'React', api: 'Ktor', database: 'SQLite' },
  capabilities: [],
}

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthGate><main>Offline portfolio shell</main></AuthGate>
    </QueryClientProvider>,
  )
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value })
}

describe('AuthGate offline shell', () => {
  beforeEach(() => {
    cleanup()
    const storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    setOnline(true)
    vi.mocked(useAppMeta).mockReturnValue({
      data: meta,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAppMeta>)
    vi.mocked(useAuthSession).mockReturnValue({
      data: { authEnabled: false, authenticated: true, mode: 'DISABLED' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthSession>)
  })

  it('remembers only the auth-disabled shell and renders it when startup APIs are offline', async () => {
    const online = renderGate()
    await waitFor(() => expect(window.localStorage.getItem('portfolio:offline-shell:auth-disabled-v1')).toBe('true'))
    online.unmount()

    setOnline(false)
    vi.mocked(useAppMeta).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
    } as unknown as ReturnType<typeof useAppMeta>)
    vi.mocked(useAuthSession).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
    } as unknown as ReturnType<typeof useAuthSession>)

    renderGate()
    expect(screen.getByRole('main')).toHaveTextContent('Offline portfolio shell')
  })

  it('does not remember or bypass an enabled authentication gate', async () => {
    window.localStorage.setItem('portfolio:offline-shell:auth-disabled-v1', 'true')
    vi.mocked(useAuthSession).mockReturnValue({
      data: { authEnabled: true, authenticated: true, mode: 'PASSWORD' },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthSession>)

    const online = renderGate()
    await waitFor(() => expect(window.localStorage.getItem('portfolio:offline-shell:auth-disabled-v1')).toBeNull())
    online.unmount()

    setOnline(false)
    vi.mocked(useAppMeta).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
    } as unknown as ReturnType<typeof useAppMeta>)
    vi.mocked(useAuthSession).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
    } as unknown as ReturnType<typeof useAuthSession>)

    renderGate()
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
    expect(screen.getByText(/nie można połączyć|not reachable/i)).toBeInTheDocument()
  })
})
