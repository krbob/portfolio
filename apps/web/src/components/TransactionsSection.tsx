import { useMemo, useState, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import { useAccounts, useCreateTransaction, useInstruments, useTransactions } from '../hooks/use-write-model'

const today = new Date().toISOString().slice(0, 10)

const initialForm = {
  accountId: '',
  instrumentId: '',
  type: 'DEPOSIT',
  tradeDate: today,
  settlementDate: today,
  quantity: '',
  unitPrice: '',
  grossAmount: '1000.00',
  feeAmount: '0',
  taxAmount: '0',
  currency: 'PLN',
  fxRateToPln: '',
  notes: '',
}

export function TransactionsSection() {
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const createTransactionMutation = useCreateTransaction()
  const [form, setForm] = useState(initialForm)

  const requiresInstrument = form.type === 'BUY' || form.type === 'SELL'
  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []

  const canSubmit = useMemo(() => {
    return form.accountId !== '' && (!requiresInstrument || form.instrumentId !== '')
  }, [form.accountId, form.instrumentId, requiresInstrument])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createTransactionMutation.mutate(
      {
        accountId: form.accountId,
        instrumentId: requiresInstrument ? form.instrumentId : null,
        type: form.type,
        tradeDate: form.tradeDate,
        settlementDate: form.settlementDate,
        quantity: requiresInstrument ? form.quantity : null,
        unitPrice: requiresInstrument ? form.unitPrice : null,
        grossAmount: form.grossAmount,
        feeAmount: form.feeAmount,
        taxAmount: form.taxAmount,
        currency: form.currency,
        fxRateToPln: form.fxRateToPln || null,
        notes: form.notes,
      },
      {
        onSuccess: () =>
          setForm((current) => ({
            ...initialForm,
            accountId: current.accountId,
            currency: current.currency,
          })),
      },
    )
  }

  return (
    <SectionCard
      eyebrow="Write model"
      title="Transactions"
      description="Cash flows and trades are the canonical portfolio events that everything else will derive from."
    >
      <div className="section-body section-body-wide">
        <form className="entity-form entity-form-wide" onSubmit={handleSubmit}>
          <label>
            <span>Account</span>
            <select
              value={form.accountId}
              onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              required
            >
              <option value="">Select account</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Type</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="FEE">FEE</option>
              <option value="TAX">TAX</option>
              <option value="INTEREST">INTEREST</option>
              <option value="CORRECTION">CORRECTION</option>
            </select>
          </label>

          <label>
            <span>Trade date</span>
            <input
              type="date"
              value={form.tradeDate}
              onChange={(event) => setForm((current) => ({ ...current, tradeDate: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Settlement date</span>
            <input
              type="date"
              value={form.settlementDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, settlementDate: event.target.value }))
              }
            />
          </label>

          <label>
            <span>Instrument</span>
            <select
              value={form.instrumentId}
              onChange={(event) =>
                setForm((current) => ({ ...current, instrumentId: event.target.value }))
              }
              disabled={!requiresInstrument}
            >
              <option value="">Not required</option>
              {instrumentOptions.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Quantity</span>
            <input
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="10"
              disabled={!requiresInstrument}
            />
          </label>

          <label>
            <span>Unit price</span>
            <input
              value={form.unitPrice}
              onChange={(event) =>
                setForm((current) => ({ ...current, unitPrice: event.target.value }))
              }
              placeholder="123.45"
              disabled={!requiresInstrument}
            />
          </label>

          <label>
            <span>Gross amount</span>
            <input
              value={form.grossAmount}
              onChange={(event) =>
                setForm((current) => ({ ...current, grossAmount: event.target.value }))
              }
              required
            />
          </label>

          <label>
            <span>Fee amount</span>
            <input
              value={form.feeAmount}
              onChange={(event) => setForm((current) => ({ ...current, feeAmount: event.target.value }))}
            />
          </label>

          <label>
            <span>Tax amount</span>
            <input
              value={form.taxAmount}
              onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))}
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
            <span>FX rate to PLN</span>
            <input
              value={form.fxRateToPln}
              onChange={(event) =>
                setForm((current) => ({ ...current, fxRateToPln: event.target.value }))
              }
              placeholder="4.0321"
            />
          </label>

          <label className="form-span-wide">
            <span>Notes</span>
            <input
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional audit note"
            />
          </label>

          <button type="submit" disabled={!canSubmit || createTransactionMutation.isPending}>
            {createTransactionMutation.isPending ? 'Saving...' : 'Add transaction'}
          </button>
          {createTransactionMutation.error && (
            <p className="form-error">{createTransactionMutation.error.message}</p>
          )}
        </form>

        <div className="entity-list">
          {transactionsQuery.isLoading && <p className="muted-copy">Loading transactions...</p>}
          {transactionsQuery.isError && (
            <p className="form-error">{transactionsQuery.error.message}</p>
          )}
          {transactionsQuery.data?.length === 0 && <p className="muted-copy">No transactions yet.</p>}
          {transactionsQuery.data?.map((transaction) => (
            <article className="list-item" key={transaction.id}>
              <div>
                <strong>
                  {transaction.type} · {transaction.grossAmount} {transaction.currency}
                </strong>
                <p>
                  {transaction.tradeDate}
                  {transaction.instrumentId ? ` · instrument ${transaction.instrumentId.slice(0, 8)}` : ''}
                </p>
              </div>
              <span className="list-badge">{transaction.accountId.slice(0, 8)}</span>
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
