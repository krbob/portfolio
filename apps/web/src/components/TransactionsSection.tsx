import { useMemo, useState, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import {
  useAccounts,
  useCreateTransaction,
  useDeleteTransaction,
  useImportTransactions,
  useInstruments,
  useTransactions,
  useUpdateTransaction,
} from '../hooks/use-write-model'
import type { CreateTransactionPayload, Transaction } from '../api/write-model'

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
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()
  const importTransactionsMutation = useImportTransactions()
  const [form, setForm] = useState(initialForm)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [importCsv, setImportCsv] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const requiresInstrument = form.type === 'BUY' || form.type === 'SELL'
  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []

  const canSubmit = useMemo(() => {
    return form.accountId !== '' && (!requiresInstrument || form.instrumentId !== '')
  }, [form.accountId, form.instrumentId, requiresInstrument])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
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
    }

    if (editingTransactionId) {
      updateTransactionMutation.mutate(
        {
          id: editingTransactionId,
          ...payload,
        },
        {
          onSuccess: () => resetForm(),
        },
      )
      return
    }

    createTransactionMutation.mutate(payload, {
      onSuccess: () =>
        setForm((current) => ({
          ...initialForm,
          accountId: current.accountId,
          currency: current.currency,
        })),
    })
  }

  function startEditing(transaction: Transaction) {
    setEditingTransactionId(transaction.id)
    setForm({
      accountId: transaction.accountId,
      instrumentId: transaction.instrumentId ?? '',
      type: transaction.type,
      tradeDate: transaction.tradeDate,
      settlementDate: transaction.settlementDate ?? transaction.tradeDate,
      quantity: transaction.quantity ?? '',
      unitPrice: transaction.unitPrice ?? '',
      grossAmount: transaction.grossAmount,
      feeAmount: transaction.feeAmount,
      taxAmount: transaction.taxAmount,
      currency: transaction.currency,
      fxRateToPln: transaction.fxRateToPln ?? '',
      notes: transaction.notes,
    })
  }

  function resetForm() {
    setEditingTransactionId(null)
    setForm(initialForm)
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportFeedback(null)
    setImportError(null)

    try {
      const rows = parseImportRows({
        csv: importCsv,
        accountOptions,
        instrumentOptions,
      })

      importTransactionsMutation.mutate(
        { rows },
        {
          onSuccess: (result) => {
            setImportFeedback(`Imported ${result.createdCount} transactions.`)
            setImportCsv('')
          },
        },
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.')
    }
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

          <div className="form-actions">
            <button
              type="submit"
              disabled={
                !canSubmit || createTransactionMutation.isPending || updateTransactionMutation.isPending
              }
            >
              {createTransactionMutation.isPending || updateTransactionMutation.isPending
                ? 'Saving...'
                : editingTransactionId
                  ? 'Save changes'
                  : 'Add transaction'}
            </button>

            {editingTransactionId && (
              <button type="button" className="button-secondary" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
          {(createTransactionMutation.error || updateTransactionMutation.error) && (
            <p className="form-error">
              {createTransactionMutation.error?.message ?? updateTransactionMutation.error?.message}
            </p>
          )}
        </form>

        <div className="entity-list">
          <form className="import-card" onSubmit={handleImportSubmit}>
            <div className="section-header">
              <p className="eyebrow">Batch import</p>
              <h4>Paste canonical CSV</h4>
              <p>
                Headers: <code>account,type,tradeDate,settlementDate,instrument,quantity,unitPrice,grossAmount,feeAmount,taxAmount,currency,fxRateToPln,notes</code>.
                Account matches by name or id. Instrument matches by name, symbol or id.
              </p>
            </div>

            <textarea
              className="import-textarea"
              value={importCsv}
              onChange={(event) => setImportCsv(event.target.value)}
              placeholder={`account,type,tradeDate,settlementDate,instrument,quantity,unitPrice,grossAmount,feeAmount,taxAmount,currency,fxRateToPln,notes\nPrimary,DEPOSIT,2026-03-01,2026-03-01,,,1000.00,0,0,PLN,,Initial funding`}
            />

            <div className="form-actions">
              <button type="submit" disabled={importTransactionsMutation.isPending || importCsv.trim() === ''}>
                {importTransactionsMutation.isPending ? 'Importing...' : 'Import CSV'}
              </button>
            </div>

            {importFeedback && <p className="muted-copy">{importFeedback}</p>}
            {(importError || importTransactionsMutation.error) && (
              <p className="form-error">{importError ?? importTransactionsMutation.error?.message}</p>
            )}
          </form>

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
                  {transaction.notes ? ` · ${transaction.notes}` : ''}
                </p>
              </div>
              <div className="list-item-actions">
                <span className="list-badge">{transaction.accountId.slice(0, 8)}</span>
                <button type="button" className="button-secondary" onClick={() => startEditing(transaction)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => deleteTransactionMutation.mutate(transaction.id)}
                  disabled={deleteTransactionMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {deleteTransactionMutation.error && (
            <p className="form-error">{deleteTransactionMutation.error.message}</p>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function parseImportRows({
  csv,
  accountOptions,
  instrumentOptions,
}: {
  csv: string
  accountOptions: Array<{ id: string; name: string }>
  instrumentOptions: Array<{ id: string; name: string; symbol: string | null }>
}): CreateTransactionPayload[] {
  const rows = parseCsv(csv)
  if (rows.length < 2) {
    throw new Error('CSV import requires a header row and at least one data row.')
  }

  const headers = rows[0].map((header) => header.trim())
  const requiredHeaders = ['account', 'type', 'tradeDate', 'grossAmount', 'currency']
  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) {
      throw new Error(`Missing required CSV header: ${header}.`)
    }
  })

  const accountLookup = new Map<string, string>()
  accountOptions.forEach((account) => {
    accountLookup.set(account.id.toLowerCase(), account.id)
    accountLookup.set(account.name.trim().toLowerCase(), account.id)
  })

  const instrumentLookup = new Map<string, string>()
  instrumentOptions.forEach((instrument) => {
    instrumentLookup.set(instrument.id.toLowerCase(), instrument.id)
    instrumentLookup.set(instrument.name.trim().toLowerCase(), instrument.id)
    if (instrument.symbol) {
      instrumentLookup.set(instrument.symbol.trim().toLowerCase(), instrument.id)
    }
  })

  return rows.slice(1)
    .filter((row) => row.some((value) => value.trim() !== ''))
    .map((row, index) => {
      const record = Object.fromEntries(headers.map((header, columnIndex) => [header, (row[columnIndex] ?? '').trim()]))
      const rowNumber = index + 2
      const accountId = accountLookup.get(record.account.toLowerCase())
      if (!accountId) {
        throw new Error(`Row ${rowNumber}: unknown account '${record.account}'.`)
      }

      const type = record.type.toUpperCase()
      const requiresInstrument = type === 'BUY' || type === 'SELL'
      const instrumentId = record.instrument ? instrumentLookup.get(record.instrument.toLowerCase()) ?? null : null
      if (requiresInstrument && instrumentId == null) {
        throw new Error(`Row ${rowNumber}: instrument is required for ${type}.`)
      }

      return {
        accountId,
        instrumentId,
        type,
        tradeDate: requireValue(record.tradeDate, 'tradeDate', rowNumber),
        settlementDate: record.settlementDate || record.tradeDate || null,
        quantity: record.quantity || null,
        unitPrice: record.unitPrice || null,
        grossAmount: requireValue(record.grossAmount, 'grossAmount', rowNumber),
        feeAmount: record.feeAmount || '0',
        taxAmount: record.taxAmount || '0',
        currency: requireValue(record.currency, 'currency', rowNumber).toUpperCase(),
        fxRateToPln: record.fxRateToPln || null,
        notes: record.notes || '',
      } satisfies CreateTransactionPayload
    })
}

function requireValue(value: string | undefined, field: string, rowNumber: number): string {
  if (!value || value.trim() === '') {
    throw new Error(`Row ${rowNumber}: ${field} is required.`)
  }
  return value.trim()
}

function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let currentField = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentField)
      currentField = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      currentRow.push(currentField)
      rows.push(currentRow)
      currentField = ''
      currentRow = []
      continue
    }

    currentField += char
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  return firstLine.split(';').length > firstLine.split(',').length ? ';' : ','
}
