import { useState, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import { useCreateInstrument, useInstruments } from '../hooks/use-write-model'

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
    <SectionCard
      eyebrow="Write model"
      title="Instruments"
      description="Keep ETF, benchmark, and purchase-specific EDO instruments in one canonical catalog."
    >
      <div className="section-body">
        <form className="entity-form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="VWCE"
              required
            />
          </label>

          <label>
            <span>Kind</span>
            <select value={form.kind} onChange={(event) => handleKindChange(event.target.value)}>
              <option value="ETF">ETF</option>
              <option value="STOCK">STOCK</option>
              <option value="BOND_EDO">BOND_EDO</option>
              <option value="CASH">CASH</option>
              <option value="BENCHMARK_GOLD">BENCHMARK_GOLD</option>
            </select>
          </label>

          <label>
            <span>Asset class</span>
            <select
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
          </label>

          <label>
            <span>Symbol</span>
            <input
              value={form.symbol}
              onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}
              placeholder="VWCE.DE"
              disabled={isEdo}
            />
          </label>

          <label>
            <span>Currency</span>
            <input
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
              }
              maxLength={3}
              required
            />
          </label>

          <label>
            <span>Valuation source</span>
            <select
              value={form.valuationSource}
              onChange={(event) =>
                setForm((current) => ({ ...current, valuationSource: event.target.value }))
              }
            >
              <option value="STOCK_ANALYST">STOCK_ANALYST</option>
              <option value="EDO_CALCULATOR">EDO_CALCULATOR</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </label>

          {isEdo && (
            <>
              <label>
                <span>Purchase date</span>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, purchaseDate: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>First period rate (bps)</span>
                <input
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
              </label>

              <label>
                <span>Margin (bps)</span>
                <input
                  type="number"
                  value={form.marginBps}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, marginBps: Number(event.target.value) }))
                  }
                  required
                />
              </label>

              <label>
                <span>Principal units</span>
                <input
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
              </label>

              <label>
                <span>Maturity date</span>
                <input
                  type="date"
                  value={form.maturityDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, maturityDate: event.target.value }))
                  }
                  required
                />
              </label>
            </>
          )}

          <button type="submit" disabled={createInstrumentMutation.isPending}>
            {createInstrumentMutation.isPending ? 'Saving...' : 'Add instrument'}
          </button>
          {createInstrumentMutation.error && (
            <p className="form-error">{createInstrumentMutation.error.message}</p>
          )}
        </form>

        <div className="entity-list">
          {instrumentsQuery.isLoading && <p className="muted-copy">Loading instruments...</p>}
          {instrumentsQuery.isError && <p className="form-error">{instrumentsQuery.error.message}</p>}
          {instrumentsQuery.data?.length === 0 && <p className="muted-copy">No instruments yet.</p>}
          {instrumentsQuery.data?.map((instrument) => (
            <article className="list-item" key={instrument.id}>
              <div>
                <strong>{instrument.name}</strong>
                <p>
                  {instrument.kind} · {instrument.assetClass}
                  {instrument.symbol ? ` · ${instrument.symbol}` : ''}
                </p>
              </div>
              <span className="list-badge">{instrument.currency}</span>
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
