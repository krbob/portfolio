import { useState, type FormEvent } from 'react'
import { Card, SectionHeader } from './ui'
import { useCreateInstrument, useInstruments } from '../hooks/use-write-model'
import { label as labelClass, input, btnPrimary, badge, badgeVariants } from '../lib/styles'

const today = new Date().toISOString().slice(0, 10)
const maturity = new Date(new Date().setFullYear(new Date().getFullYear() + 10))
  .toISOString()
  .slice(0, 10)

const initialForm = {
  name: '',
  kind: 'ETF',
  assetClass: 'EQUITIES',
  symbol: '',
  currency: 'USD',
  valuationSource: 'STOCK_ANALYST',
  purchaseDate: today,
  firstPeriodRateBps: 650,
  marginBps: 200,
  principalUnits: 10,
  maturityDate: maturity,
}

export function InstrumentsSection() {
  const instrumentsQuery = useInstruments()
  const createInstrumentMutation = useCreateInstrument()
  const [form, setForm] = useState(initialForm)

  const isEdo = form.kind === 'BOND_EDO'

  function handleKindChange(nextKind: string) {
    setForm((current) => {
      if (nextKind === 'BOND_EDO') {
        return {
          ...current,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createInstrumentMutation.mutate(
      {
        name: form.name,
        kind: form.kind,
        assetClass: form.assetClass,
        symbol: form.symbol || null,
        currency: form.currency,
        valuationSource: form.valuationSource,
        edoTerms: isEdo
          ? {
              purchaseDate: form.purchaseDate,
              firstPeriodRateBps: form.firstPeriodRateBps,
              marginBps: form.marginBps,
              principalUnits: form.principalUnits,
              maturityDate: form.maturityDate,
            }
          : null,
      },
      {
        onSuccess: () => setForm(initialForm),
      },
    )
  }

  return (
    <Card>
      <SectionHeader
        eyebrow="Write model"
        title="Instruments"
        description="Keep ETF, benchmark, and purchase-specific EDO instruments in one canonical catalog."
      />

      <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
        <div>
          <span className={labelClass}>Name</span>
          <input
            className={input}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="VWCE"
            required
          />
        </div>

        <div>
          <span className={labelClass}>Kind</span>
          <select className={input} value={form.kind} onChange={(event) => handleKindChange(event.target.value)}>
            <option value="ETF">ETF</option>
            <option value="STOCK">STOCK</option>
            <option value="BOND_EDO">BOND_EDO</option>
            <option value="CASH">CASH</option>
            <option value="BENCHMARK_GOLD">BENCHMARK_GOLD</option>
          </select>
        </div>

        <div>
          <span className={labelClass}>Asset class</span>
          <select
            className={input}
            value={form.assetClass}
            onChange={(event) =>
              setForm((current) => ({ ...current, assetClass: event.target.value }))
            }
          >
            <option value="EQUITIES">EQUITIES</option>
            <option value="BONDS">BONDS</option>
            <option value="CASH">CASH</option>
            <option value="FX">FX</option>
            <option value="BENCHMARK">BENCHMARK</option>
          </select>
        </div>

        <div>
          <span className={labelClass}>Symbol</span>
          <input
            className={input}
            value={form.symbol}
            onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}
            placeholder="VWCE.DE"
            disabled={isEdo}
          />
        </div>

        <div>
          <span className={labelClass}>Currency</span>
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
          <span className={labelClass}>Valuation source</span>
          <select
            className={input}
            value={form.valuationSource}
            onChange={(event) =>
              setForm((current) => ({ ...current, valuationSource: event.target.value }))
            }
          >
            <option value="STOCK_ANALYST">STOCK_ANALYST</option>
            <option value="EDO_CALCULATOR">EDO_CALCULATOR</option>
            <option value="MANUAL">MANUAL</option>
          </select>
        </div>

        {isEdo && (
          <>
            <div>
              <span className={labelClass}>Purchase date</span>
              <input
                className={input}
                type="date"
                value={form.purchaseDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, purchaseDate: event.target.value }))
                }
                required
              />
            </div>

            <div>
              <span className={labelClass}>First period rate (bps)</span>
              <input
                className={input}
                type="number"
                value={form.firstPeriodRateBps}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstPeriodRateBps: Number(event.target.value),
                  }))
                }
                required
              />
            </div>

            <div>
              <span className={labelClass}>Margin (bps)</span>
              <input
                className={input}
                type="number"
                value={form.marginBps}
                onChange={(event) =>
                  setForm((current) => ({ ...current, marginBps: Number(event.target.value) }))
                }
                required
              />
            </div>

            <div>
              <span className={labelClass}>Principal units</span>
              <input
                className={input}
                type="number"
                value={form.principalUnits}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    principalUnits: Number(event.target.value),
                  }))
                }
                required
              />
            </div>

            <div>
              <span className={labelClass}>Maturity date</span>
              <input
                className={input}
                type="date"
                value={form.maturityDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maturityDate: event.target.value }))
                }
                required
              />
            </div>
          </>
        )}

        <div className="col-span-full flex items-center gap-3 mt-2">
          <button className={btnPrimary} type="submit" disabled={createInstrumentMutation.isPending}>
            {createInstrumentMutation.isPending ? 'Saving...' : 'Add instrument'}
          </button>
          {createInstrumentMutation.error && (
            <p className="text-sm text-red-400">{createInstrumentMutation.error.message}</p>
          )}
        </div>
      </form>

      <div className="space-y-3 mt-4">
        {instrumentsQuery.isLoading && <p className="text-sm text-zinc-500">Loading instruments...</p>}
        {instrumentsQuery.isError && <p className="text-sm text-red-400">{instrumentsQuery.error.message}</p>}
        {instrumentsQuery.data?.length === 0 && <p className="text-sm text-zinc-500">No instruments yet.</p>}
        {instrumentsQuery.data?.map((instrument) => (
          <article className="rounded-lg border border-zinc-800/50 p-4 flex items-center justify-between" key={instrument.id}>
            <div>
              <strong className="text-sm text-zinc-100">{instrument.name}</strong>
              <p className="text-sm text-zinc-500">
                {instrument.kind} · {instrument.assetClass}
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
