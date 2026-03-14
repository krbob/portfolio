import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SectionCard } from './SectionCard'
import {
  useAccounts,
  useCreateTransaction,
  useDeleteTransaction,
  useImportTransactions,
  useInstruments,
  usePreviewTransactionsImport,
  useTransactions,
  useUpdateTransaction,
} from '../hooks/use-write-model'
import type {
  CreateTransactionPayload,
  ImportTransactionsPayload,
  ImportTransactionsPreviewResult,
  Transaction,
} from '../api/write-model'

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

const initialJournalFilters = {
  search: '',
  accountId: 'ALL',
  instrumentId: 'ALL',
  type: 'ALL',
  currency: 'ALL',
  sort: 'tradeDate-desc',
  pageSize: '10',
}

export function TransactionsSection() {
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const createTransactionMutation = useCreateTransaction()
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()
  const importTransactionsMutation = useImportTransactions()
  const previewTransactionsImportMutation = usePreviewTransactionsImport()
  const [form, setForm] = useState(initialForm)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [importCsv, setImportCsv] = useState('')
  const [importSkipDuplicates, setImportSkipDuplicates] = useState(true)
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [journalFilters, setJournalFilters] = useState(initialJournalFilters)
  const [currentPage, setCurrentPage] = useState(1)

  const requiresInstrument = form.type === 'BUY' || form.type === 'SELL'
  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []

  const canSubmit = useMemo(() => {
    return form.accountId !== '' && (!requiresInstrument || form.instrumentId !== '')
  }, [form.accountId, form.instrumentId, requiresInstrument])

  const accountNameById = useMemo(
    () => new Map(accountOptions.map((account) => [account.id, account.name])),
    [accountOptions],
  )
  const instrumentById = useMemo(
    () => new Map(instrumentOptions.map((instrument) => [instrument.id, instrument])),
    [instrumentOptions],
  )

  const journalRows = useMemo(() => {
    return (transactionsQuery.data ?? []).map((transaction) => {
      const instrument = transaction.instrumentId ? instrumentById.get(transaction.instrumentId) ?? null : null
      return {
        transaction,
        accountName: accountNameById.get(transaction.accountId) ?? transaction.accountId.slice(0, 8),
        instrumentName: instrument?.name ?? null,
        instrumentSymbol: instrument?.symbol ?? null,
      }
    })
  }, [transactionsQuery.data, accountNameById, instrumentById])

  const currencyOptions = useMemo(() => {
    return Array.from(new Set(journalRows.map((row) => row.transaction.currency))).sort()
  }, [journalRows])

  const filteredRows = useMemo(() => {
    const search = journalFilters.search.trim().toLowerCase()
    return journalRows.filter((row) => {
      if (journalFilters.accountId !== 'ALL' && row.transaction.accountId !== journalFilters.accountId) {
        return false
      }
      if (
        journalFilters.instrumentId !== 'ALL' &&
        (row.transaction.instrumentId ?? '') !== journalFilters.instrumentId
      ) {
        return false
      }
      if (journalFilters.type !== 'ALL' && row.transaction.type !== journalFilters.type) {
        return false
      }
      if (journalFilters.currency !== 'ALL' && row.transaction.currency !== journalFilters.currency) {
        return false
      }
      if (search === '') {
        return true
      }

      const haystack = [
        row.transaction.type,
        row.transaction.tradeDate,
        row.transaction.settlementDate ?? '',
        row.transaction.grossAmount,
        row.transaction.quantity ?? '',
        row.transaction.unitPrice ?? '',
        row.transaction.currency,
        row.transaction.notes,
        row.accountName,
        row.instrumentName ?? '',
        row.instrumentSymbol ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [journalFilters, journalRows])

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows]
    rows.sort((left, right) => compareJournalRows(left, right, journalFilters.sort))
    return rows
  }, [filteredRows, journalFilters.sort])

  const pageSize = Number(journalFilters.pageSize)
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [currentPage, pageSize, sortedRows])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    journalFilters.accountId,
    journalFilters.currency,
    journalFilters.instrumentId,
    journalFilters.pageSize,
    journalFilters.search,
    journalFilters.sort,
    journalFilters.type,
  ])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    setImportFeedback(null)
    setImportError(null)
    setImportPreview(null)
  }, [importCsv, importSkipDuplicates, accountOptions, instrumentOptions])

  const importBlockedByPreview = Boolean(
    importPreview &&
      (importPreview.invalidRowCount > 0 || (!importSkipDuplicates && importPreview.duplicateRowCount > 0)),
  )

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

  function updateJournalFilter(name: keyof typeof initialJournalFilters, value: string) {
    setJournalFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportFeedback(null)
    setImportError(null)

    try {
      const payload = buildImportPayload({
        csv: importCsv,
        skipDuplicates: importSkipDuplicates,
        accountOptions,
        instrumentOptions,
      })

      importTransactionsMutation.mutate(
        payload,
        {
          onSuccess: (result) => {
            setImportFeedback(buildImportResultMessage(result.createdCount, result.skippedDuplicateCount))
            setImportCsv('')
            setImportPreview(null)
          },
        },
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  function handleImportPreview() {
    setImportFeedback(null)
    setImportError(null)

    try {
      const payload = buildImportPayload({
        csv: importCsv,
        skipDuplicates: importSkipDuplicates,
        accountOptions,
        instrumentOptions,
      })

      previewTransactionsImportMutation.mutate(payload, {
        onSuccess: (result) => {
          setImportPreview(result)
        },
      })
    } catch (error) {
      setImportPreview(null)
      setImportError(error instanceof Error ? error.message : 'Preview failed.')
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
              <h4>Preview and import canonical CSV</h4>
              <p>
                Headers: <code>account,type,tradeDate,settlementDate,instrument,quantity,unitPrice,grossAmount,feeAmount,taxAmount,currency,fxRateToPln,notes</code>.
                Account matches by name or id. Instrument matches by name, symbol or id.
              </p>
            </div>

            <textarea
              className="import-textarea"
              value={importCsv}
              onChange={(event) => setImportCsv(event.target.value)}
              placeholder={`account,type,tradeDate,settlementDate,instrument,quantity,unitPrice,grossAmount,feeAmount,taxAmount,currency,fxRateToPln,notes\nPrimary,DEPOSIT,2026-03-01,2026-03-01,,,,1000.00,0,0,PLN,,Initial funding`}
            />

            <label className="import-option">
              <input
                type="checkbox"
                checked={importSkipDuplicates}
                onChange={(event) => setImportSkipDuplicates(event.target.checked)}
              />
              <span>Skip duplicate rows during import</span>
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={handleImportPreview}
                disabled={previewTransactionsImportMutation.isPending || importCsv.trim() === ''}
              >
                {previewTransactionsImportMutation.isPending ? 'Previewing...' : 'Preview import'}
              </button>
              <button
                type="submit"
                disabled={
                  importTransactionsMutation.isPending ||
                  previewTransactionsImportMutation.isPending ||
                  importCsv.trim() === '' ||
                  importBlockedByPreview
                }
              >
                {importTransactionsMutation.isPending ? 'Importing...' : 'Import CSV'}
              </button>
            </div>

            {importPreview && (
              <div className="import-preview">
                <div className="import-preview-grid">
                  <article className="import-preview-card">
                    <span>Total rows</span>
                    <strong>{importPreview.totalRowCount}</strong>
                  </article>
                  <article className="import-preview-card">
                    <span>Importable</span>
                    <strong>{importPreview.importableRowCount}</strong>
                  </article>
                  <article className="import-preview-card">
                    <span>Duplicates</span>
                    <strong>{importPreview.duplicateRowCount}</strong>
                  </article>
                  <article className="import-preview-card">
                    <span>Invalid</span>
                    <strong>{importPreview.invalidRowCount}</strong>
                  </article>
                </div>

                <p className="muted-copy">
                  {importSkipDuplicates
                    ? 'Duplicate rows will be skipped automatically if you continue with the import.'
                    : 'Duplicate rows are currently blocking the import. Enable duplicate skipping or fix the batch.'}
                </p>

                <div className="import-preview-list">
                  {importPreview.rows.map((row) => (
                    <article className="import-preview-row" key={`${row.rowNumber}-${row.status}`}>
                      <div>
                        <strong>Row {row.rowNumber}</strong>
                        <p>{row.message}</p>
                      </div>
                      <span className={`import-preview-badge import-preview-badge-${row.status.toLowerCase()}`}>
                        {formatImportRowStatus(row.status)}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {importFeedback && <p className="muted-copy">{importFeedback}</p>}
            {(importError || previewTransactionsImportMutation.error || importTransactionsMutation.error) && (
              <p className="form-error">
                {importError ??
                  previewTransactionsImportMutation.error?.message ??
                  importTransactionsMutation.error?.message}
              </p>
            )}
          </form>

          <section className="journal-card">
            <div className="section-header">
              <p className="eyebrow">Journal</p>
              <h4>Transaction journal</h4>
              <p>
                Filter and sort the canonical event stream before editing or deleting rows.
              </p>
            </div>

            <div className="journal-toolbar">
              <label className="journal-filter journal-filter-wide">
                <span>Search</span>
                <input
                  value={journalFilters.search}
                  onChange={(event) => updateJournalFilter('search', event.target.value)}
                  placeholder="Type, account, instrument, note, amount..."
                />
              </label>

              <label className="journal-filter">
                <span>Account</span>
                <select
                  value={journalFilters.accountId}
                  onChange={(event) => updateJournalFilter('accountId', event.target.value)}
                >
                  <option value="ALL">All accounts</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="journal-filter">
                <span>Instrument</span>
                <select
                  value={journalFilters.instrumentId}
                  onChange={(event) => updateJournalFilter('instrumentId', event.target.value)}
                >
                  <option value="ALL">All instruments</option>
                  {instrumentOptions.map((instrument) => (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="journal-filter">
                <span>Type</span>
                <select
                  value={journalFilters.type}
                  onChange={(event) => updateJournalFilter('type', event.target.value)}
                >
                  <option value="ALL">All types</option>
                  {['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'FEE', 'TAX', 'INTEREST', 'CORRECTION'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="journal-filter">
                <span>Currency</span>
                <select
                  value={journalFilters.currency}
                  onChange={(event) => updateJournalFilter('currency', event.target.value)}
                >
                  <option value="ALL">All currencies</option>
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="journal-filter">
                <span>Sort</span>
                <select
                  value={journalFilters.sort}
                  onChange={(event) => updateJournalFilter('sort', event.target.value)}
                >
                  <option value="tradeDate-desc">Trade date newest</option>
                  <option value="tradeDate-asc">Trade date oldest</option>
                  <option value="grossAmount-desc">Gross amount high to low</option>
                  <option value="grossAmount-asc">Gross amount low to high</option>
                  <option value="type-asc">Type A to Z</option>
                  <option value="account-asc">Account A to Z</option>
                  <option value="createdAt-desc">Recently created</option>
                </select>
              </label>
            </div>

            <div className="journal-summary">
              <span>
                Showing {pagedRows.length} of {sortedRows.length} matching rows ({journalRows.length} total).
              </span>

              <div className="journal-pagination">
                <label className="journal-page-size">
                  <span>Rows</span>
                  <select
                    value={journalFilters.pageSize}
                    onChange={(event) => updateJournalFilter('pageSize', event.target.value)}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          {transactionsQuery.isLoading && <p className="muted-copy">Loading transactions...</p>}
          {transactionsQuery.isError && (
            <p className="form-error">{transactionsQuery.error.message}</p>
          )}
          {transactionsQuery.data?.length === 0 && <p className="muted-copy">No transactions yet.</p>}
          {transactionsQuery.data?.length !== 0 && pagedRows.length === 0 && (
            <p className="muted-copy">No journal rows match the current filters.</p>
          )}
          {pagedRows.map(({ transaction, accountName, instrumentName, instrumentSymbol }) => (
            <article className="list-item" key={transaction.id}>
              <div className="transaction-row-main">
                <strong>
                  {transaction.type} · {transaction.grossAmount} {transaction.currency} · {accountName}
                </strong>
                <p>
                  trade {transaction.tradeDate}
                  {transaction.settlementDate ? ` · settle ${transaction.settlementDate}` : ''}
                  {instrumentName ? ` · ${instrumentName}` : ''}
                  {instrumentSymbol ? ` (${instrumentSymbol})` : ''}
                  {transaction.quantity ? ` · qty ${transaction.quantity}` : ''}
                  {transaction.unitPrice ? ` · px ${transaction.unitPrice}` : ''}
                  {transaction.notes ? ` · ${transaction.notes}` : ''}
                </p>
                <p className="transaction-row-meta">
                  fee {transaction.feeAmount} · tax {transaction.taxAmount}
                  {transaction.fxRateToPln ? ` · fx ${transaction.fxRateToPln}` : ''}
                  {` · created ${transaction.createdAt.slice(0, 10)}`}
                </p>
              </div>
              <div className="list-item-actions">
                <span className="list-badge">{transaction.id.slice(0, 8)}</span>
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

function buildImportPayload({
  csv,
  skipDuplicates,
  accountOptions,
  instrumentOptions,
}: {
  csv: string
  skipDuplicates: boolean
  accountOptions: Array<{ id: string; name: string }>
  instrumentOptions: Array<{ id: string; name: string; symbol?: string | null }>
}): ImportTransactionsPayload {
  return {
    skipDuplicates,
    rows: parseImportRows({
      csv,
      accountOptions,
      instrumentOptions,
    }),
  }
}

function buildImportResultMessage(createdCount: number, skippedDuplicateCount: number) {
  if (skippedDuplicateCount === 0) {
    return `Imported ${createdCount} transactions.`
  }

  return `Imported ${createdCount} transactions and skipped ${skippedDuplicateCount} duplicates.`
}

function formatImportRowStatus(status: string) {
  switch (status) {
    case 'IMPORTABLE':
      return 'Importable'
    case 'DUPLICATE_EXISTING':
      return 'Existing duplicate'
    case 'DUPLICATE_BATCH':
      return 'Batch duplicate'
    case 'INVALID':
      return 'Invalid'
    default:
      return status
  }
}

function parseImportRows({
  csv,
  accountOptions,
  instrumentOptions,
}: {
  csv: string
  accountOptions: Array<{ id: string; name: string }>
  instrumentOptions: Array<{ id: string; name: string; symbol?: string | null }>
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

function compareJournalRows(
  left: {
    transaction: Transaction
    accountName: string
    instrumentName: string | null
  },
  right: {
    transaction: Transaction
    accountName: string
    instrumentName: string | null
  },
  sort: string,
) {
  switch (sort) {
    case 'tradeDate-asc':
      return compareStrings(left.transaction.tradeDate, right.transaction.tradeDate)
    case 'grossAmount-desc':
      return compareNumbers(right.transaction.grossAmount, left.transaction.grossAmount)
    case 'grossAmount-asc':
      return compareNumbers(left.transaction.grossAmount, right.transaction.grossAmount)
    case 'type-asc':
      return compareStrings(left.transaction.type, right.transaction.type)
    case 'account-asc':
      return compareStrings(left.accountName, right.accountName)
    case 'createdAt-desc':
      return compareStrings(right.transaction.createdAt, left.transaction.createdAt)
    case 'tradeDate-desc':
    default:
      return compareStrings(right.transaction.tradeDate, left.transaction.tradeDate)
  }
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right)
}

function compareNumbers(left: string, right: string) {
  return Number(left) - Number(right)
}
