import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { PortfolioTargetScheduleEditor } from './PortfolioTargetScheduleEditor'

const phases = [
  targetPhase('phase-1', '2020-01-01', 0.8, 0.2),
  targetPhase('phase-2', '2025-01-01', 0.75, 0.25),
  targetPhase('phase-3', '2030-01-01', 0.7, 0.3),
]

describe('PortfolioTargetScheduleEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-18T10:00:00+02:00'))
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
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the effective and next phase and rejects duplicate dates', async () => {
    mockScheduleApi()
    renderEditor()

    expect(await screen.findByRole('heading', { name: 'Harmonogram alokacji' })).toBeInTheDocument()
    await screen.findAllByLabelText('Obowiązuje od')
    expect(screen.getByText('Obowiązuje teraz')).toBeInTheDocument()
    expect(screen.getByText('Następna zmiana')).toBeInTheDocument()
    expect(screen.getAllByText(/Akcje 75/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Akcje 70/i).length).toBeGreaterThan(0)

    const dateInputs = screen.getAllByLabelText('Obowiązuje od')
    fireEvent.change(dateInputs[2], { target: { value: '2025-01-01' } })

    expect(await screen.findAllByText('Każda faza musi mieć inną datę rozpoczęcia.')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Zapisz harmonogram' })).toBeDisabled()
  })

  it('renders exact decimal percentages from stored fractional weights', async () => {
    mockScheduleApi([], [
      {
        ...targetPhase('phase-exact', '2026-01-01', 0.58, 0.29),
        items: [
          { assetClass: 'EQUITIES', targetWeight: '0.580000' },
          { assetClass: 'BONDS', targetWeight: '0.290000' },
          { assetClass: 'CASH', targetWeight: '0.130000' },
        ],
      },
    ])
    renderEditor()

    await screen.findAllByLabelText('Obowiązuje od')
    expect(screen.getByLabelText(/^Akcje/)).toHaveValue('58')
    expect(screen.getByLabelText(/^Obligacje/)).toHaveValue('29')
    expect(screen.getByLabelText(/^Gotówka/)).toHaveValue('13')
  })

  it('generates five fully editable 5-year phases after confirmation', async () => {
    mockScheduleApi()
    renderEditor()

    await screen.findByRole('heading', { name: 'Harmonogram alokacji' })
    await userEvent.click(screen.getByRole('button', { name: 'Wygeneruj 80/20 → 60/40' }))

    expect(await screen.findByRole('dialog', { name: 'Zastąpić edytowany harmonogram?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wygeneruj fazy' }))

    await waitFor(() => {
      expect(screen.getAllByLabelText('Obowiązuje od')).toHaveLength(5)
    })
    expect(screen.getAllByLabelText('Obowiązuje od').map((element) => (element as HTMLInputElement).value)).toEqual([
      '2026-07-18',
      '2031-07-18',
      '2036-07-18',
      '2041-07-18',
      '2046-07-18',
    ])
    expect(screen.getAllByLabelText(/^Akcje/).map((element) => (element as HTMLInputElement).value)).toEqual([
      '80', '75', '70', '65', '60',
    ])

    fireEvent.change(screen.getAllByLabelText(/^Akcje/)[1], { target: { value: '73' } })
    fireEvent.change(screen.getAllByLabelText(/^Obligacje/)[1], { target: { value: '27' } })
    expect(screen.getAllByLabelText(/^Akcje/)[1]).toHaveValue('73')
    expect(screen.getByRole('button', { name: 'Zapisz harmonogram' })).toBeEnabled()
  })

  it('requires confirmation before saving a change to a historical phase', async () => {
    const postedBodies: unknown[] = []
    mockScheduleApi(postedBodies)
    renderEditor()

    await screen.findByRole('heading', { name: 'Harmonogram alokacji' })
    await screen.findAllByLabelText('Obowiązuje od')
    fireEvent.change(screen.getAllByLabelText(/^Akcje/)[0], { target: { value: '79' } })
    fireEvent.change(screen.getAllByLabelText(/^Obligacje/)[0], { target: { value: '21' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Zmieniasz historyczną część strategii')
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz harmonogram' }))

    expect(postedBodies).toHaveLength(0)
    expect(await screen.findByRole('dialog', { name: 'Zapisać zmianę historii strategii?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz zmianę' }))

    await waitFor(() => {
      expect(postedBodies).toHaveLength(1)
    })
    expect(postedBodies[0]).toMatchObject({
      phases: [
        {
          id: 'phase-1',
          effectiveFrom: '2020-01-01',
          items: [
            { assetClass: 'EQUITIES', targetWeight: '0.790000' },
            { assetClass: 'BONDS', targetWeight: '0.210000' },
          ],
        },
        { id: 'phase-2', effectiveFrom: '2025-01-01' },
        { id: 'phase-3', effectiveFrom: '2030-01-01' },
      ],
    })
  })

  it('allows removing the whole schedule only after explicit confirmation', async () => {
    const postedBodies: unknown[] = []
    mockScheduleApi(postedBodies)
    renderEditor()

    await screen.findByRole('heading', { name: 'Harmonogram alokacji' })
    await screen.findAllByLabelText('Obowiązuje od')
    for (const button of screen.getAllByRole('button', { name: 'Usuń' })) {
      await userEvent.click(button)
    }

    await userEvent.click(screen.getByRole('button', { name: 'Zapisz harmonogram' }))
    expect(await screen.findByRole('dialog', { name: 'Usunąć harmonogram alokacji?' })).toBeInTheDocument()
    expect(postedBodies).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Usuń harmonogram' }))
    await waitFor(() => {
      expect(postedBodies).toEqual([{ phases: [] }])
    })
  })

  it('rejects a mix that no longer totals 100 percent after API precision rounding', async () => {
    mockScheduleApi()
    renderEditor()

    await screen.findAllByLabelText('Obowiązuje od')
    fireEvent.change(screen.getAllByLabelText(/^Akcje/)[0], { target: { value: '33.33334' } })
    fireEvent.change(screen.getAllByLabelText(/^Obligacje/)[0], { target: { value: '33.33333' } })
    fireEvent.change(screen.getAllByLabelText(/^Gotówka/)[0], { target: { value: '33.33333' } })

    expect(await screen.findByText('Po zaokrągleniu zapisywane wagi muszą sumować się dokładnie do 100%.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zapisz harmonogram' })).toBeDisabled()
  })

  it('preserves an unsaved draft when the query is refreshed in the background', async () => {
    mockScheduleApi()
    const queryClient = renderEditor()

    await screen.findAllByLabelText('Obowiązuje od')
    fireEvent.change(screen.getAllByLabelText(/^Akcje/)[1], { target: { value: '74' } })
    fireEvent.change(screen.getAllByLabelText(/^Obligacje/)[1], { target: { value: '26' } })
    await act(async () => {
      queryClient.setQueryData(
        ['portfolio-target-schedule'],
        phases.map((phase) => ({ ...phase, updatedAt: '2026-07-18T08:00:00Z' })),
      )
    })

    expect(screen.getAllByLabelText(/^Akcje/)[1]).toHaveValue('74')
    expect(screen.getAllByLabelText(/^Obligacje/)[1]).toHaveValue('26')
    expect(screen.getByRole('button', { name: 'Zapisz harmonogram' })).toBeEnabled()
  })
})

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PortfolioTargetScheduleEditor />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return queryClient
}

function mockScheduleApi(postedBodies: unknown[] = [], responsePhases = phases) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    if (!url.includes('/api/v1/portfolio/target-schedule')) {
      throw new Error(`Unhandled fetch in target schedule test: ${url}`)
    }
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      postedBodies.push(body)
      return jsonResponse(body.phases.map((phase: Record<string, unknown>, index: number) => ({
        ...phase,
        id: phase.id ?? `new-${index}`,
        createdAt: '2026-07-18T08:00:00Z',
        updatedAt: '2026-07-18T08:00:00Z',
      })))
    }
    return jsonResponse(responsePhases)
  })
}

function targetPhase(id: string, effectiveFrom: string, equities: number, bonds: number) {
  return {
    id,
    effectiveFrom,
    items: [
      { assetClass: 'EQUITIES', targetWeight: equities.toFixed(6) },
      { assetClass: 'BONDS', targetWeight: bonds.toFixed(6) },
    ],
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
