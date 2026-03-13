import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders dashboard shell with API data', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/v1/meta')) {
        return new Response(
          JSON.stringify({
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
          { status: 200 },
        )
      }

      if (url.includes('/api/v1/accounts') || url.includes('/api/v1/instruments') || url.includes('/api/v1/transactions')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    })

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
    expect(screen.getByRole('heading', { name: /accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instruments/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument()
  })
})
