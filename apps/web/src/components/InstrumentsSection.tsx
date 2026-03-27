import { useState, type FormEvent } from 'react'
import { Card, SectionHeader } from './ui'
import { useCreateInstrument, useUpdateInstrument, useInstruments } from '../hooks/use-write-model'
import { useI18n } from '../lib/i18n'
import { labelAssetClass, labelInstrumentKind, labelValuationSource } from '../lib/labels'
import { label as labelClass, input, btnPrimary, btnSecondary, badge, badgeVariants } from '../lib/styles'

const currentSeriesMonth = new Date().toISOString().slice(0, 7)

const MONTHS = [
  { value: '01', pl: 'Styczeń', en: 'January' },
  { value: '02', pl: 'Luty', en: 'February' },
  { value: '03', pl: 'Marzec', en: 'March' },
  { value: '04', pl: 'Kwiecień', en: 'April' },
  { value: '05', pl: 'Maj', en: 'May' },
  { value: '06', pl: 'Czerwiec', en: 'June' },
  { value: '07', pl: 'Lipiec', en: 'July' },
  { value: '08', pl: 'Sierpień', en: 'August' },
  { value: '09', pl: 'Wrzesień', en: 'September' },
  { value: '10', pl: 'Październik', en: 'October' },
  { value: '11', pl: 'Listopad', en: 'November' },
  { value: '12', pl: 'Grudzień', en: 'December' },
] as const

function edoYearOptions(): string[] {
  const currentYear = new Date().getFullYear()
  const years: string[] = []
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    years.push(String(y))
  }
  return years
}

function buildEdoSeriesName(seriesMonth: string): string {
  const [yearString, monthString] = seriesMonth.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 'EDO'
  }
  return `EDO${String(month).padStart(2, '0')}${String((year + 10) % 100).padStart(2, '0')}`
}

const initialForm = {
  name: '',
  kind: 'ETF',
  assetClass: 'EQUITIES',
  symbol: '',
  currency: 'USD',
  valuationSource: 'STOCK_ANALYST',
  seriesMonth: currentSeriesMonth,
  firstPeriodRateBps: '650',
  marginBps: '200',
}

export function InstrumentsSection() {
  const { isPolish } = useI18n()
  const instrumentsQuery = useInstruments()
  const createInstrumentMutation = useCreateInstrument()
  const updateInstrumentMutation = useUpdateInstrument()
  const [form, setForm] = useState(initialForm)
  const [editingInstrumentId, setEditingInstrumentId] = useState<string | null>(null)

  const isEditing = editingInstrumentId !== null
  const isEdo = form.kind === 'BOND_EDO'
  const activeMutation = isEditing ? updateInstrumentMutation : createInstrumentMutation

  function handleKindChange(nextKind: string) {
    setForm((current) => {
      if (nextKind === 'BOND_EDO') {
        return {
          ...current,
          name: buildEdoSeriesName(current.seriesMonth),
          kind: nextKind,
          assetClass: 'BONDS',
          currency: 'PLN',
          valuationSource: 'EDO_CALCULATOR',
          symbol: '',
        }
      }

      return {
        ...current,
        kind: nextKind,
        assetClass: nextKind === 'BENCHMARK_GOLD' ? 'BENCHMARK' : current.assetClass,
        valuationSource: nextKind === 'BENCHMARK_GOLD' ? 'MANUAL' : current.valuationSource,
      }
    })
  }

  function handleEditClick(instrument: NonNullable<typeof instrumentsQuery.data>[number]) {
    setEditingInstrumentId(instrument.id)
    setForm({
      name: instrument.name,
      kind: instrument.kind,
      assetClass: instrument.assetClass,
      symbol: instrument.symbol ?? '',
      currency: instrument.currency,
      valuationSource: instrument.valuationSource,
      seriesMonth: instrument.edoTerms?.seriesMonth ?? currentSeriesMonth,
      firstPeriodRateBps: String(instrument.edoTerms?.firstPeriodRateBps ?? 650),
      marginBps: String(instrument.edoTerms?.marginBps ?? 200),
    })
  }

  function handleCancelEdit() {
    setEditingInstrumentId(null)
    setForm(initialForm)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const edoTerms = isEdo
      ? {
          seriesMonth: form.seriesMonth,
          firstPeriodRateBps: Number(form.firstPeriodRateBps),
          marginBps: Number(form.marginBps),
        }
      : null

    if (isEditing) {
      updateInstrumentMutation.mutate(
        {
          id: editingInstrumentId,
          name: form.name,
          symbol: form.symbol || null,
          currency: form.currency,
          valuationSource: form.valuationSource,
          edoTerms,
        },
        {
          onSuccess: () => {
            setForm(initialForm)
            setEditingInstrumentId(null)
          },
        },
      )
    } else {
      createInstrumentMutation.mutate(
        {
          name: form.name,
          kind: form.kind,
          assetClass: form.assetClass,
          symbol: form.symbol || null,
          currency: form.currency,
          valuationSource: form.valuationSource,
          edoTerms,
        },
        {
          onSuccess: () => setForm(initialForm),
        },
      )
    }
  }

  return (
    <Card>
      <SectionHeader
        eyebrow={isPolish ? 'Model zapisu' : 'Write model'}
        title={isPolish ? 'Instrumenty' : 'Instruments'}
        description={isPolish
          ? 'Trzymaj ETF-y, benchmarki i miesięczne serie EDO w jednym katalogu instrumentów.'
          : 'Keep ETF, benchmark, and monthly EDO series in one canonical catalog.'}
      />

      {isEditing && (
        <p className="text-sm font-medium text-blue-400 mb-2">
          {isPolish ? 'Edytuj instrument' : 'Edit instrument'}
        </p>
      )}

      <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
        <div>
          <span className={labelClass}>{isPolish ? 'Nazwa' : 'Name'}</span>
          <input
            className={input}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="VWCE"
            readOnly={isEdo}
            required
          />
        </div>

        <div>
          <span className={labelClass}>{isPolish ? 'Rodzaj' : 'Kind'}</span>
          <select className={input} value={form.kind} onChange={(event) => handleKindChange(event.target.value)} disabled={isEditing}>
            <option value="ETF">{labelInstrumentKind('ETF')}</option>
            <option value="STOCK">{labelInstrumentKind('STOCK')}</option>
            <option value="BOND_EDO">{labelInstrumentKind('BOND_EDO')}</option>
            <option value="CASH">{labelInstrumentKind('CASH')}</option>
            <option value="BENCHMARK_GOLD">{labelInstrumentKind('BENCHMARK_GOLD')}</option>
          </select>
        </div>

        <div>
          <span className={labelClass}>{isPolish ? 'Klasa aktywów' : 'Asset class'}</span>
          <select
            className={input}
            value={form.assetClass}
            onChange={(event) =>
              setForm((current) => ({ ...current, assetClass: event.target.value }))
            }
            disabled={isEditing}
          >
            <option value="EQUITIES">{labelAssetClass('EQUITIES')}</option>
            <option value="BONDS">{labelAssetClass('BONDS')}</option>
            <option value="CASH">{labelAssetClass('CASH')}</option>
            <option value="FX">{labelAssetClass('FX')}</option>
            <option value="BENCHMARK">{labelAssetClass('BENCHMARK')}</option>
          </select>
        </div>

        {!isEdo && (
          <div>
            <span className={labelClass}>{isPolish ? 'Symbol' : 'Symbol'}</span>
            <input
              className={input}
              value={form.symbol}
              onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}
              placeholder="VWCE.DE"
            />
          </div>
        )}

        <div>
          <span className={labelClass}>{isPolish ? 'Waluta' : 'Currency'}</span>
          <input
            className={input}
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
            }
            maxLength={3}
            required
          />
        </div>

        <div>
          <span className={labelClass}>{isPolish ? 'Źródło wyceny' : 'Valuation source'}</span>
          <select
            className={input}
            value={form.valuationSource}
            onChange={(event) =>
              setForm((current) => ({ ...current, valuationSource: event.target.value }))
            }
          >
            <option value="STOCK_ANALYST">{labelValuationSource('STOCK_ANALYST')}</option>
            <option value="EDO_CALCULATOR">{labelValuationSource('EDO_CALCULATOR')}</option>
            <option value="MANUAL">{labelValuationSource('MANUAL')}</option>
          </select>
        </div>

        {isEdo && (
          <>
            <div>
              <span className={labelClass}>{isPolish ? 'Miesiąc serii' : 'Series month'}</span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={input}
                  value={form.seriesMonth.split('-')[1] ?? '01'}
                  onChange={(event) => {
                    const year = form.seriesMonth.split('-')[0]
                    const next = `${year}-${event.target.value}`
                    setForm((current) => ({ ...current, seriesMonth: next, name: buildEdoSeriesName(next) }))
                  }}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{isPolish ? m.pl : m.en}</option>
                  ))}
                </select>
                <select
                  className={input}
                  value={form.seriesMonth.split('-')[0]}
                  onChange={(event) => {
                    const month = form.seriesMonth.split('-')[1] ?? '01'
                    const next = `${event.target.value}-${month}`
                    setForm((current) => ({ ...current, seriesMonth: next, name: buildEdoSeriesName(next) }))
                  }}
                >
                  {edoYearOptions().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className={labelClass}>{isPolish ? 'Oprocentowanie 1. okresu (bps)' : 'First period rate (bps)'}</span>
              <input
                className={input}
                type="number"
                step={10}
                value={form.firstPeriodRateBps}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstPeriodRateBps: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div>
              <span className={labelClass}>{isPolish ? 'Marża (bps)' : 'Margin (bps)'}</span>
              <input
                className={input}
                type="number"
                step={10}
                value={form.marginBps}
                onChange={(event) =>
                  setForm((current) => ({ ...current, marginBps: event.target.value }))
                }
                required
              />
            </div>
          </>
        )}

        <div className="col-span-full flex items-center gap-3 mt-2">
          <button className={btnPrimary} type="submit" disabled={activeMutation.isPending}>
            {activeMutation.isPending
              ? (isPolish ? 'Zapisywanie...' : 'Saving...')
              : isEditing
                ? (isPolish ? 'Zapisz zmiany' : 'Save changes')
                : (isPolish ? 'Dodaj instrument' : 'Add instrument')}
          </button>
          {isEditing && (
            <button className={btnSecondary} type="button" onClick={handleCancelEdit}>
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
          )}
          {activeMutation.error && (
            <p className="text-sm text-red-400">{activeMutation.error.message}</p>
          )}
        </div>
      </form>

      <div className="space-y-3 mt-4">
        {instrumentsQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie instrumentów...' : 'Loading instruments...'}</p>}
        {instrumentsQuery.isError && <p className="text-sm text-red-400">{instrumentsQuery.error.message}</p>}
        {instrumentsQuery.data?.length === 0 && <p className="text-sm text-zinc-500">{isPolish ? 'Brak instrumentów.' : 'No instruments yet.'}</p>}
        {instrumentsQuery.data?.map((instrument) => (
          <article
            className="rounded-lg border border-zinc-800/50 p-4 flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors"
            key={instrument.id}
            onClick={() => handleEditClick(instrument)}
          >
            <div>
              <strong className="text-sm text-zinc-100">{instrument.name}</strong>
              <p className="text-sm text-zinc-500">
                {labelInstrumentKind(instrument.kind)} · {labelAssetClass(instrument.assetClass)}
                {instrument.symbol ? ` · ${instrument.symbol}` : ''}
              </p>
            </div>
            <span className={`${badge} ${badgeVariants.default}`}>{instrument.currency}</span>
          </article>
        ))}
      </div>
    </Card>
  )
}
