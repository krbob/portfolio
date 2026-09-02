import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { PortfolioBenchmarkSettingsSection } from './PortfolioBenchmarkSettingsSection'

const benchmarkSettings = {
  enabledKeys: ['VWRA', 'CUSTOM_EUROPE'],
  pinnedKeys: ['VWRA'],
  customBenchmarks: [
    { key: 'CUSTOM_EUROPE', label: 'Europa 600', symbol: 'EXSA.DE' },
  ],
  equityBenchmarkSchedule: [
    { effectiveFrom: null, symbol: 'VWRA.L' },
    { effectiveFrom: '2026-08-25', symbol: 'VGLA.DE' },
  ],
  options: [
    {
      key: 'VWRA',
      label: 'Global equity benchmark',
      symbol: null,
      kind: 'SYSTEM',
      configurable: true,
      defaultEnabled: true,
      defaultPinned: true,
    },
    {
      key: 'CUSTOM_EUROPE',
      label: 'Europa 600',
      symbol: 'EXSA.DE',
      kind: 'CUSTOM',
      configurable: true,
      defaultEnabled: false,
      defaultPinned: false,
    },
  ],
}

describe('PortfolioBenchmarkSettingsSection', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'pl-PL',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['pl-PL'],
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('edits and saves an explicit equity benchmark schedule without losing other settings', async () => {
    const postBodies: unknown[] = []
    mockBenchmarkSettingsApi(postBodies)
    renderSection()

    expect(await screen.findByRole('heading', {
      name: 'Harmonogram globalnego benchmarku akcyjnego',
    })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Globalny benchmark akcyjny' })).toBeInTheDocument()
    expect(screen.getByText('Od początku')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^Obowiązuje od/)).toHaveLength(1)
    expect(screen.getAllByLabelText(/^Symbol benchmarku akcyjnego/)).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Usuń zmianę' })).toHaveLength(1)

    fireEvent.change(screen.getAllByLabelText(/^Symbol benchmarku akcyjnego/)[1], {
      target: { value: 'vgla.de' },
    })
    expect(screen.getAllByLabelText(/^Symbol benchmarku akcyjnego/)[1]).toHaveValue('VGLA.DE')

    const addButton = screen.getByRole('button', { name: 'Dodaj zmianę symbolu' })
    expect(addButton).not.toBeDisabled()
    fireEvent.click(addButton)
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Obowiązuje od/)).toHaveLength(2)
    })
    const dates = screen.getAllByLabelText(/^Obowiązuje od/)
    const symbols = screen.getAllByLabelText(/^Symbol benchmarku akcyjnego/)
    expect(symbols).toHaveLength(3)
    fireEvent.change(dates[1], { target: { value: '2031-01-01' } })
    fireEvent.change(symbols[2], { target: { value: 'next.l' } })

    await userEvent.click(screen.getByRole('button', { name: 'Zapisz benchmarki' }))

    await waitFor(() => {
      expect(postBodies).toHaveLength(1)
    })
    expect(postBodies[0]).toEqual({
      enabledKeys: ['VWRA', 'CUSTOM_EUROPE'],
      pinnedKeys: ['VWRA'],
      customBenchmarks: [
        { key: 'CUSTOM_EUROPE', label: 'Europa 600', symbol: 'EXSA.DE' },
      ],
      equityBenchmarkSchedule: [
        { effectiveFrom: null, symbol: 'VWRA.L' },
        { effectiveFrom: '2026-08-25', symbol: 'VGLA.DE' },
        { effectiveFrom: '2031-01-01', symbol: 'NEXT.L' },
      ],
    })
  })

  it('rejects non-increasing dates and allows removing a dated phase', async () => {
    const postBodies: unknown[] = []
    mockBenchmarkSettingsApi(postBodies)
    renderSection()

    await screen.findByText('Od początku')
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj zmianę symbolu' }))
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Obowiązuje od/)).toHaveLength(2)
    })
    fireEvent.change(screen.getAllByLabelText(/^Obowiązuje od/)[1], {
      target: { value: '2026-08-25' },
    })
    fireEvent.change(screen.getAllByLabelText(/^Symbol benchmarku akcyjnego/)[2], {
      target: { value: 'NEXT.L' },
    })

    expect(screen.getByText('Data musi być późniejsza niż data poprzedniej fazy.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz benchmarki' }))
    expect(postBodies).toHaveLength(0)
    expect(screen.getByText(
      'Popraw harmonogram globalnego benchmarku akcyjnego przed zapisem.',
    )).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Usuń zmianę' })[1])
    expect(screen.getAllByRole('button', { name: 'Usuń zmianę' })).toHaveLength(1)
    expect(screen.getAllByLabelText(/^Symbol benchmarku akcyjnego/)).toHaveLength(2)
  })

  it('uses the legacy VWRA option while an older API omits the schedule field', async () => {
    const postBodies: unknown[] = []
    const { equityBenchmarkSchedule: _omitted, ...legacySettings } = benchmarkSettings
    legacySettings.options = legacySettings.options.map((option) => (
      option.key === 'VWRA' ? { ...option, symbol: 'VWRA.L' } : option
    ))
    mockBenchmarkSettingsApi(postBodies, legacySettings)
    renderSection()

    const symbols = await screen.findAllByLabelText(/^Symbol benchmarku akcyjnego/)

    expect(symbols).toHaveLength(1)
    expect(symbols[0]).toHaveValue('VWRA.L')
  })
})

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PortfolioBenchmarkSettingsSection />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function mockBenchmarkSettingsApi(postBodies: unknown[], response: unknown = benchmarkSettings) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    if (!url.includes('/api/v1/portfolio/benchmark-settings')) {
      throw new Error(`Unhandled fetch in benchmark settings test: ${url}`)
    }

    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      postBodies.push(body)
      return jsonResponse({ ...benchmarkSettings, ...body })
    }
    return jsonResponse(response)
  })
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
