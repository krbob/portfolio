import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders dashboard shell with API data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Portfolio',
        stage: 'dev',
        version: '0.1.0-dev',
        stack: {
          web: 'React 19 + TypeScript + Vite',
          api: 'Kotlin 2.3 + Ktor 3',
          database: 'PostgreSQL (planned)',
        },
        capabilities: ['Transaction-based portfolio accounting'],
      }),
    } as Response)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    expect(screen.getByText(/dashboard shell/i)).toBeInTheDocument()
    expect(await screen.findByText(/portfolio dev/i)).toBeInTheDocument()
    expect(screen.getByText(/transaction-based portfolio accounting/i)).toBeInTheDocument()
  })
})
