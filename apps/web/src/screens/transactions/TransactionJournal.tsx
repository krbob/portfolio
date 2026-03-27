import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DangerConfirmInline } from '../../components/DangerConfirmInline'
import { Card, EmptyState, SectionHeader } from '../../components/ui'
import { Modal } from '../../components/ui/Modal'
import { usePortfolioHoldings } from '../../hooks/use-read-model'
import { notApplicableLabel } from '../../lib/availability'
import { formatCurrency, formatDate, formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { labelTransactionType } from '../../lib/labels'
import { t } from '../../lib/messages'
import type { TransactionComposerDraft, TransactionRouteState } from '../../lib/transaction-composer'
import {
  badge,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  filterInput,
  input,
  label as labelClass,
  txBadgeVariants,
} from '../../lib/styles'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Account, Instrument, Transaction } from '../../api/write-model'
import type { CreateTransactionPayload, UpdateTransactionPayload } from '../../api/write-model'
import {
  compareAccountsByDisplayOrder,
  compareEdoLotsByPurchaseDate,
  compareInstrumentsByName,
  compareJournalRows,
  buildRedeemPreview,
  initialForm,
  initialJournalFilters,
  multiplyDecimalInputs,
  normalizeDecimalForPayload,
  normalizeIntegerInput,
  normalizeOptionalDecimalForPayload,
  toWholeUnits,
  transactionTypes,
  type JournalRow,
} from './transactions-helpers'

export interface TransactionJournalProps {
  accounts: Account[]
  instruments: Instrument[]
  transactions: Transaction[]
  holdingsQuery: ReturnType<typeof usePortfolioHoldings>
  createTransactionMutation: UseMutationResult<Transaction, Error, CreateTransactionPayload>
  updateTransactionMutation: UseMutationResult<Transaction, Error, UpdateTransactionPayload>
  deleteTransactionMutation: UseMutationResult<void, Error, string>
  onFilteredRowCountChange?: (count: number) => void
}

function JournalSummaryTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <article className="rounded-lg border border-zinc-800/70 bg-zinc-950/30 p-4">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold text-zinc-100">{value}</strong>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </article>
  )
}

export function TransactionJournal({
  accounts,
  instruments,
  transactions,
  holdingsQuery,
  createTransactionMutation,
  updateTransactionMutation,
  deleteTransactionMutation,
  onFilteredRowCountChange,
}: TransactionJournalProps) {
  const { isPolish } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [pendingDeleteTransactionId, setPendingDeleteTransactionId] = useState<string | null>(null)
  const [journalFilters, setJournalFilters] = useState(initialJournalFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [showComposer, setShowComposer] = useState(false)
  const [showSettlementDateField, setShowSettlementDateField] = useState(false)
  const [hasCustomSettlementDate, setHasCustomSettlementDate] = useState(false)
  const [grossAmountMode, setGrossAmountMode] = useState<'auto' | 'manual'>('auto')

  const routeState = (location.state as TransactionRouteState | null) ?? {}
  const pendingTransactionDraft = routeState.transactionDraft ?? null

  const composerOpen = showComposer || editingTransactionId != null
  const requiresInstrument = form.type === 'BUY' || form.type === 'SELL' || form.type === 'REDEEM'
  const decimalSeparator = isPolish ? ',' : '.'
  const accountOptions = accounts
  const instrumentOptions = instruments

  const sortedAccountOptions = useMemo(
    () => [...accountOptions].sort(compareAccountsByDisplayOrder),
    [accountOptions],
  )
  const lastUsedByInstrumentId = useMemo(() => {
    const map = new Map<string, string>()
    for (const tx of transactions) {
      if (tx.instrumentId && (!map.has(tx.instrumentId) || tx.tradeDate > map.get(tx.instrumentId)!)) {
        map.set(tx.instrumentId, tx.tradeDate)
      }
    }
    return map
  }, [transactions])

  const sortedInstrumentOptions = useMemo(() => {
    return [...instrumentOptions].sort((a, b) => {
      const aDate = lastUsedByInstrumentId.get(a.id)
      const bDate = lastUsedByInstrumentId.get(b.id)
      if (aDate && bDate) return bDate.localeCompare(aDate)
      if (aDate) return -1
      if (bDate) return 1
      return compareInstrumentsByName(a, b)
    })
  }, [instrumentOptions, lastUsedByInstrumentId])

  const canSubmit = useMemo(() => {
    return form.accountId !== '' && (!requiresInstrument || form.instrumentId !== '')
  }, [form.accountId, form.instrumentId, requiresInstrument])
  const suggestedGrossAmount = useMemo(() => {
    if (!requiresInstrument) {
      return ''
    }

    return multiplyDecimalInputs(form.quantity, form.unitPrice, decimalSeparator)
  }, [decimalSeparator, form.quantity, form.unitPrice, requiresInstrument])

  const accountNameById = useMemo(
    () => new Map(accountOptions.map((account) => [account.id, account.name])),
    [accountOptions],
  )
  const instrumentById = useMemo(
    () => new Map(instrumentOptions.map((instrument) => [instrument.id, instrument])),
    [instrumentOptions],
  )
  const redeemableEdoHoldings = useMemo(() => {
    return (holdingsQuery.data ?? [])
      .filter((holding) => {
        if (holding.kind !== 'BOND_EDO' || (holding.edoLots ?? []).length === 0) {
          return false
        }
        if (form.accountId === '') {
          return true
        }
        return holding.accountId === form.accountId
      })
      .sort((left, right) => {
        const instrumentComparison = left.instrumentName.localeCompare(right.instrumentName)
        if (instrumentComparison !== 0) {
          return instrumentComparison
        }
        return left.accountName.localeCompare(right.accountName)
      })
  }, [form.accountId, holdingsQuery.data])
  const redeemableInstrumentIds = useMemo(
    () => new Set(redeemableEdoHoldings.map((holding) => holding.instrumentId)),
    [redeemableEdoHoldings],
  )
  const selectableInstrumentOptions = useMemo(() => {
    if (form.type === 'REDEEM') {
      return sortedInstrumentOptions.filter((instrument) => redeemableInstrumentIds.has(instrument.id))
    }
    if (form.type === 'SELL') {
      return sortedInstrumentOptions.filter((instrument) => instrument.kind !== 'BOND_EDO')
    }
    return sortedInstrumentOptions
  }, [form.type, redeemableInstrumentIds, sortedInstrumentOptions])
  const selectedRedeemHolding = useMemo(() => {
    if (form.type !== 'REDEEM' || form.accountId === '' || form.instrumentId === '') {
      return null
    }

    return (
      (holdingsQuery.data ?? []).find(
        (holding) =>
          holding.accountId === form.accountId &&
          holding.instrumentId === form.instrumentId &&
          holding.kind === 'BOND_EDO',
      ) ?? null
    )
  }, [form.accountId, form.instrumentId, form.type, holdingsQuery.data])
  const selectedRedeemLots = useMemo(
    () => [...(selectedRedeemHolding?.edoLots ?? [])].sort(compareEdoLotsByPurchaseDate),
    [selectedRedeemHolding],
  )
  const redeemPreview = useMemo(
    () => buildRedeemPreview(selectedRedeemLots, form.quantity),
    [form.quantity, selectedRedeemLots],
  )

  const journalRows = useMemo<JournalRow[]>(() => {
    return (transactions ?? []).map((transaction) => {
      const instrument = transaction.instrumentId ? instrumentById.get(transaction.instrumentId) ?? null : null
      return {
        transaction,
        accountName: accountNameById.get(transaction.accountId) ?? transaction.accountId.slice(0, 8),
        instrumentName: instrument?.name ?? null,
        instrumentSymbol: instrument?.symbol ?? null,
      }
    })
  }, [transactions, accountNameById, instrumentById])

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

  useEffect(() => {
    onFilteredRowCountChange?.(sortedRows.length)
  }, [sortedRows.length, onFilteredRowCountChange])

  const pageSize = Number(journalFilters.pageSize)
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [currentPage, pageSize, sortedRows])
  const hasActiveJournalFilters = useMemo(
    () =>
      journalFilters.search !== initialJournalFilters.search ||
      journalFilters.accountId !== initialJournalFilters.accountId ||
      journalFilters.instrumentId !== initialJournalFilters.instrumentId ||
      journalFilters.type !== initialJournalFilters.type ||
      journalFilters.currency !== initialJournalFilters.currency ||
      journalFilters.sort !== initialJournalFilters.sort,
    [journalFilters],
  )
  const accountsInFilteredJournal = useMemo(
    () => new Set(filteredRows.map((row) => row.transaction.accountId)).size,
    [filteredRows],
  )
  const instrumentsInFilteredJournal = useMemo(
    () =>
      new Set(
        filteredRows
          .map((row) => row.transaction.instrumentId)
          .filter((instrumentId): instrumentId is string => instrumentId != null),
      ).size,
    [filteredRows],
  )
  const latestTradeDateInFilteredJournal = useMemo(
    () =>
      filteredRows.reduce<string | null>(
        (latest, row) =>
          latest == null || row.transaction.tradeDate > latest ? row.transaction.tradeDate : latest,
        null,
      ),
    [filteredRows],
  )

  useEffect(() => {
    if (!requiresInstrument || grossAmountMode !== 'auto') {
      return
    }

    setForm((current) =>
      current.grossAmount === suggestedGrossAmount
        ? current
        : {
            ...current,
            grossAmount: suggestedGrossAmount,
          },
    )
  }, [grossAmountMode, requiresInstrument, suggestedGrossAmount])

  useEffect(() => {
    if (!requiresInstrument || form.instrumentId === '') {
      return
    }

    if (selectableInstrumentOptions.some((instrument) => instrument.id === form.instrumentId)) {
      return
    }

    setForm((current) => ({
      ...current,
      instrumentId: '',
    }))
  }, [form.instrumentId, requiresInstrument, selectableInstrumentOptions])

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
    if (pendingTransactionDraft == null) {
      return
    }
    if (accounts == null || instruments == null) {
      return
    }
    if (pendingTransactionDraft.type === 'REDEEM' && holdingsQuery.data == null) {
      return
    }

    openComposerWithDraft(pendingTransactionDraft)
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true },
    )
  }, [
    accounts,
    holdingsQuery.data,
    instruments,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    pendingTransactionDraft,
  ])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      accountId: form.accountId,
      instrumentId: requiresInstrument ? form.instrumentId : null,
      type: form.type,
      tradeDate: form.tradeDate,
      settlementDate: form.settlementDate,
      quantity: requiresInstrument ? normalizeOptionalDecimalForPayload(form.quantity) : null,
      unitPrice: requiresInstrument ? normalizeOptionalDecimalForPayload(form.unitPrice) : null,
      grossAmount: normalizeDecimalForPayload(form.grossAmount),
      feeAmount: normalizeDecimalForPayload(form.feeAmount),
      taxAmount: normalizeDecimalForPayload(form.taxAmount),
      currency: form.currency,
      fxRateToPln: normalizeOptionalDecimalForPayload(form.fxRateToPln),
      notes: form.notes,
    }

    if (editingTransactionId) {
      updateTransactionMutation.mutate(
        {
          id: editingTransactionId,
          ...payload,
        },
        {
          onSuccess: () => closeComposer(),
        },
      )
      return
    }

    createTransactionMutation.mutate(payload, {
      onSuccess: () => closeComposer(),
    })
  }

  function startEditing(transaction: Transaction) {
    const settlementDate = transaction.settlementDate ?? transaction.tradeDate
    setShowComposer(true)
    setShowSettlementDateField(settlementDate !== transaction.tradeDate)
    setHasCustomSettlementDate(settlementDate !== transaction.tradeDate)
    setGrossAmountMode('manual')
    setPendingDeleteTransactionId(null)
    setEditingTransactionId(transaction.id)
    setForm({
      accountId: transaction.accountId,
      instrumentId: transaction.instrumentId ?? '',
      type: transaction.type,
      tradeDate: transaction.tradeDate,
      settlementDate,
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
    setShowSettlementDateField(false)
    setHasCustomSettlementDate(false)
    setGrossAmountMode('auto')
    setForm(initialForm)
  }

  function openComposerForCreate() {
    openComposerWithDraft(null)
  }

  function openComposerWithDraft(draft: TransactionComposerDraft | null) {
    setPendingDeleteTransactionId(null)
    setEditingTransactionId(null)
    setShowSettlementDateField(false)
    setHasCustomSettlementDate(false)
    setGrossAmountMode(draft?.grossAmount ? 'manual' : 'auto')
    const draftInstrument = draft?.instrumentId ? instrumentOptions.find((i) => i.id === draft.instrumentId) : null
    const defaultUnitPrice = draft?.unitPrice ?? (draftInstrument?.kind === 'BOND_EDO' ? '100' : initialForm.unitPrice)
    setForm({
      ...initialForm,
      accountId: draft?.accountId ?? initialForm.accountId,
      instrumentId: draft?.instrumentId ?? initialForm.instrumentId,
      type: draft?.type ?? initialForm.type,
      tradeDate: draft?.tradeDate ?? initialForm.tradeDate,
      settlementDate: draft?.settlementDate ?? draft?.tradeDate ?? initialForm.settlementDate,
      quantity: draft?.quantity ?? initialForm.quantity,
      unitPrice: defaultUnitPrice,
      grossAmount: draft?.grossAmount ?? initialForm.grossAmount,
      feeAmount: draft?.feeAmount ?? initialForm.feeAmount,
      taxAmount: draft?.taxAmount ?? initialForm.taxAmount,
      currency: draft?.currency ?? initialForm.currency,
      fxRateToPln: draft?.fxRateToPln ?? initialForm.fxRateToPln,
      notes: draft?.notes ?? initialForm.notes,
    })
    setShowComposer(true)
  }

  function closeComposer() {
    resetForm()
    setShowComposer(false)
  }

  function handleTradeDateChange(nextTradeDate: string) {
    setForm((current) => ({
      ...current,
      tradeDate: nextTradeDate,
      settlementDate: hasCustomSettlementDate ? current.settlementDate : nextTradeDate,
    }))
  }

  function handleSettlementDateChange(nextSettlementDate: string) {
    setForm((current) => ({
      ...current,
      settlementDate: nextSettlementDate,
    }))
    setHasCustomSettlementDate(nextSettlementDate !== form.tradeDate)
  }

  function openSettlementDateField() {
    setShowSettlementDateField(true)
  }

  function resetSettlementDateToTradeDate() {
    setForm((current) => ({
      ...current,
      settlementDate: current.tradeDate,
    }))
    setHasCustomSettlementDate(false)
    setShowSettlementDateField(false)
  }

  function handleTypeChange(nextType: string) {
    setForm((current) => ({
      ...current,
      type: nextType,
    }))
  }

  function handleQuantityChange(nextQuantity: string) {
    setForm((current) => ({
      ...current,
      quantity: normalizeIntegerInput(nextQuantity),
    }))
  }

  function handleUnitPriceChange(nextUnitPrice: string) {
    setForm((current) => ({
      ...current,
      unitPrice: nextUnitPrice,
    }))
  }

  function handleGrossAmountChange(nextGrossAmount: string) {
    setGrossAmountMode('manual')
    setForm((current) => ({
      ...current,
      grossAmount: nextGrossAmount,
    }))
  }

  function applySuggestedGrossAmount() {
    setGrossAmountMode('auto')
    setForm((current) => ({
      ...current,
      grossAmount: suggestedGrossAmount,
    }))
  }

  function updateJournalFilter(name: keyof typeof initialJournalFilters, value: string) {
    setJournalFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function resetJournalFilters() {
    setJournalFilters(initialJournalFilters)
    setCurrentPage(1)
  }

  function requestDeleteTransaction(transactionId: string) {
    setPendingDeleteTransactionId(transactionId)
  }

  function cancelDeleteTransaction() {
    setPendingDeleteTransactionId(null)
  }

  function confirmDeleteTransaction(transactionId: string) {
    deleteTransactionMutation.mutate(transactionId, {
      onSuccess: () => {
        setPendingDeleteTransactionId(null)
      },
    })
  }

  return (
    <>
      <div
        className="space-y-4"
        role="tabpanel"
        id="transactions-workspace-panel-journal"
        aria-labelledby="transactions-workspace-tab-journal"
      >
        <Card as="section" className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeader
              eyebrow={t('journal.eyebrow')}
              title={t('journal.title')}
              description={t('journal.description')}
              className="mb-0"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={composerOpen ? btnSecondary : btnPrimary}
                onClick={() => {
                  if (composerOpen) {
                    closeComposer()
                  } else {
                    openComposerForCreate()
                  }
                }}
              >
                {composerOpen ? t('journal.closeEditor') : t('journal.newTransaction')}
              </button>
              {hasActiveJournalFilters && (
                <button type="button" className={btnGhost} onClick={resetJournalFilters}>
                  {t('journal.clearFilters')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <JournalSummaryTile
              label={t('journal.rowsInView')}
              value={sortedRows.length.toString()}
              hint={isPolish ? `${journalRows.length} łącznie` : `${journalRows.length} total`}
            />
            <JournalSummaryTile
              label={t('journal.accountsInView')}
              value={accountsInFilteredJournal.toString()}
              hint={isPolish ? `${pagedRows.length} na tej stronie` : `${pagedRows.length} on this page`}
            />
            <JournalSummaryTile
              label={t('journal.instrumentsInView')}
              value={instrumentsInFilteredJournal.toString()}
              hint={hasActiveJournalFilters ? t('journal.afterFilters') : t('journal.noFilters')}
            />
            <JournalSummaryTile
              label={t('journal.latestTradeDate')}
              value={
                latestTradeDateInFilteredJournal
                  ? formatDate(latestTradeDateInFilteredJournal)
                  : notApplicableLabel(isPolish)
              }
              hint={isPolish ? `Strona ${currentPage} / ${totalPages}` : `Page ${currentPage} / ${totalPages}`}
            />
          </div>
        </Card>

        <Modal
          open={composerOpen}
          onClose={closeComposer}
          title={editingTransactionId ? t('journal.editTransaction') : t('journal.newTransaction')}
          size="2xl"
        >
          <div className="space-y-5">
            <p className="text-sm text-zinc-400">
              {editingTransactionId ? t('journal.editSaveHint') : t('journal.createHint')}
            </p>

            <form className="grid grid-cols-2 gap-3 lg:grid-cols-4" onSubmit={handleSubmit}>
              <label>
                <span className={labelClass}>{t('journal.account')}</span>
                <select
                  className={input}
                  value={form.accountId}
                  onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
                  required
                >
                  <option value="">{t('journal.selectAccount')}</option>
                  {sortedAccountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>{t('journal.type')}</span>
                <select
                  className={input}
                  value={form.type}
                  onChange={(event) => handleTypeChange(event.target.value)}
                >
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {labelTransactionType(type)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>{t('journal.tradeDate')}</span>
                <input
                  className={input}
                  type="date"
                  value={form.tradeDate}
                  onChange={(event) => handleTradeDateChange(event.target.value)}
                  required
                />
              </label>

              {requiresInstrument && (
                <label>
                  <span className={labelClass}>{t('journal.instrument')}</span>
                  <select
                    className={input}
                    value={form.instrumentId}
                    onChange={(event) => {
                      const nextId = event.target.value
                      const selected = instrumentOptions.find((i) => i.id === nextId)
                      setForm((current) => ({
                        ...current,
                        instrumentId: nextId,
                        unitPrice: selected?.kind === 'BOND_EDO' && (current.unitPrice === '' || current.unitPrice === '0')
                          ? '100'
                          : current.unitPrice,
                      }))
                    }}
                  >
                    <option value="">{t('journal.selectInstrument')}</option>
                    {selectableInstrumentOptions.map((instrument) => (
                      <option key={instrument.id} value={instrument.id}>
                        {instrument.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {requiresInstrument && (
                <div>
                  <label>
                  <span className={labelClass}>{t('journal.quantity')}</span>
                  <input
                    className={input}
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(event) => handleQuantityChange(event.target.value)}
                    placeholder="10"
                  />
                  </label>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t('journal.wholeUnitsOnly')}
                  </p>
                </div>
              )}

              {form.type === 'REDEEM' && (
                <div className="col-span-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {t('journal.activeEdoLots')}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {t('journal.redeemFifoHint')}
                      </p>
                    </div>

                    {selectedRedeemLots.length > 0 && (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => handleQuantityChange(String(redeemPreview.totalAvailableQuantity))}
                      >
                        {t('journal.redeemAll')}
                      </button>
                    )}
                  </div>

                  {holdingsQuery.isLoading ? (
                    <p className="mt-4 text-sm text-zinc-500">
                      {t('journal.loadingEdoLots')}
                    </p>
                  ) : holdingsQuery.error ? (
                    <p className="mt-4 text-sm text-amber-300">
                      {isPolish
                        ? `Nie udało się pobrać aktywnych partii EDO: ${holdingsQuery.error.message}`
                        : `Failed to load active EDO lots: ${holdingsQuery.error.message}`}
                    </p>
                  ) : form.accountId === '' ? (
                    <p className="mt-4 text-sm text-zinc-500">
                      {t('journal.selectAccountForLots')}
                    </p>
                  ) : redeemableEdoHoldings.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500">
                      {t('journal.noEdoLots')}
                    </p>
                  ) : selectedRedeemHolding == null ? (
                    <p className="mt-4 text-sm text-zinc-500">
                      {t('journal.selectEdoSeries')}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs uppercase tracking-wider text-zinc-500">
                            {t('journal.availableUnits')}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-100">
                            {formatNumber(redeemPreview.totalAvailableQuantity, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs uppercase tracking-wider text-zinc-500">
                            {t('journal.selectedForRedemption')}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-100">
                            {formatNumber(redeemPreview.requestedQuantity, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs uppercase tracking-wider text-zinc-500">
                            {t('journal.previewShortfall')}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-100">
                            {formatNumber(redeemPreview.unmatchedQuantity, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedRedeemLots.map((lot) => {
                          const lotPreview = redeemPreview.byPurchaseDate.get(lot.purchaseDate)
                          const fullyConsumed =
                            lotPreview != null &&
                            lotPreview.consumedQuantity > 0 &&
                            lotPreview.remainingQuantity === 0

                          return (
                            <div
                              key={lot.purchaseDate}
                              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-zinc-100">
                                    {formatDate(lot.purchaseDate)}
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-500">
                                    {isPolish
                                      ? `${formatNumber(lot.quantity, { maximumFractionDigits: 0 })} szt. · koszt ${formatCurrency(lot.costBasisPln, 'PLN')}`
                                      : `${formatNumber(lot.quantity, { maximumFractionDigits: 0 })} units · cost ${formatCurrency(lot.costBasisPln, 'PLN')}`}
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-500">
                                    {lot.currentValuePln != null
                                      ? isPolish
                                        ? `Bieżąca wartość ${formatCurrency(lot.currentValuePln, 'PLN')} · wynik ${formatCurrency(lot.unrealizedGainPln, 'PLN')}`
                                        : `Current value ${formatCurrency(lot.currentValuePln, 'PLN')} · P/L ${formatCurrency(lot.unrealizedGainPln, 'PLN')}`
                                      : lot.valuationIssue ?? t('journal.lotValuationUnavailable')}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {lotPreview != null && lotPreview.consumedQuantity > 0 && (
                                    <span className={badge}>
                                      {fullyConsumed
                                        ? t('journal.fullyConsumedFifo')
                                        : isPolish
                                          ? `FIFO: ${formatNumber(lotPreview.consumedQuantity, { maximumFractionDigits: 0 })} szt.`
                                          : `FIFO: ${formatNumber(lotPreview.consumedQuantity, { maximumFractionDigits: 0 })} units`}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className={btnGhost}
                                    onClick={() =>
                                      handleQuantityChange(String(toWholeUnits(lot.quantity)))
                                    }
                                  >
                                    {t('journal.redeemThisLot')}
                                  </button>
                                </div>
                              </div>

                              {lotPreview != null && lotPreview.consumedQuantity > 0 && (
                                <p className="mt-3 text-sm text-zinc-400">
                                  {isPolish
                                    ? `Po podglądzie FIFO zostanie ${formatNumber(lotPreview.remainingQuantity, { maximumFractionDigits: 0 })} szt. z tej partii.`
                                    : `FIFO preview leaves ${formatNumber(lotPreview.remainingQuantity, { maximumFractionDigits: 0 })} units in this lot.`}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {redeemPreview.unmatchedQuantity > 0 && (
                        <p className="text-sm text-amber-300">
                          {isPolish
                            ? `Wpisana liczba sztuk przekracza dostępne partie o ${formatNumber(redeemPreview.unmatchedQuantity, { maximumFractionDigits: 0 })} szt.`
                            : `The entered quantity exceeds available lots by ${formatNumber(redeemPreview.unmatchedQuantity, { maximumFractionDigits: 0 })} units.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {requiresInstrument && (
                <label>
                  <span className={labelClass}>{t('journal.unitPrice')}</span>
                  <input
                    className={input}
                    inputMode="decimal"
                    value={form.unitPrice}
                    onChange={(event) => handleUnitPriceChange(event.target.value)}
                    placeholder={isPolish ? '123,45' : '123.45'}
                  />
                </label>
              )}

              <div>
                <label className={labelClass} htmlFor="transaction-gross-amount">
                  {t('journal.grossAmount')}
                </label>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>
                    {grossAmountMode === 'auto' && requiresInstrument
                      ? t('journal.grossAmountAuto')
                      : t('journal.grossAmountManual')}
                  </span>
                  {requiresInstrument && (
                    <button type="button" className={btnGhost} onClick={applySuggestedGrossAmount}>
                      {t('journal.recalculate')}
                    </button>
                  )}
                </div>
                <input
                  id="transaction-gross-amount"
                  className={input}
                  inputMode="decimal"
                  value={form.grossAmount}
                  onChange={(event) => handleGrossAmountChange(event.target.value)}
                  placeholder={isPolish ? '246,90' : '246.90'}
                  required
                />
              </div>

              <label>
                <span className={labelClass}>{t('journal.feeAmount')}</span>
                <input
                  className={input}
                  inputMode="decimal"
                  value={form.feeAmount}
                  onChange={(event) => setForm((current) => ({ ...current, feeAmount: event.target.value }))}
                  placeholder={isPolish ? '0,00' : '0.00'}
                />
              </label>

              <label>
                <span className={labelClass}>{t('journal.taxAmount')}</span>
                <input
                  className={input}
                  inputMode="decimal"
                  value={form.taxAmount}
                  onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))}
                  placeholder={isPolish ? '0,00' : '0.00'}
                />
              </label>

              <label>
                <span className={labelClass}>{t('journal.currency')}</span>
                <input
                  className={input}
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                  }
                  maxLength={3}
                  required
                />
              </label>

              {form.currency !== 'PLN' && (
                <label>
                  <span className={labelClass}>{t('journal.fxRateToPln')}</span>
                  <input
                    className={input}
                    inputMode="decimal"
                    value={form.fxRateToPln}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fxRateToPln: event.target.value }))
                    }
                    placeholder={isPolish ? '4,0321' : '4.0321'}
                  />
                </label>
              )}

              <label className="col-span-2">
                <span className={labelClass}>{t('journal.notes')}</span>
                <input
                  className={input}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={t('journal.notesPlaceholder')}
                />
              </label>

              <div className="col-span-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {t('journal.settlementDate')}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {showSettlementDateField ? t('journal.settlementCustomHint') : t('journal.settlementDefaultHint')}
                    </p>
                  </div>

                  {showSettlementDateField ? (
                    <button type="button" className={btnGhost} onClick={resetSettlementDateToTradeDate}>
                      {t('journal.useTradeDate')}
                    </button>
                  ) : (
                    <button type="button" className={btnGhost} onClick={openSettlementDateField}>
                      {t('journal.setAnotherDate')}
                    </button>
                  )}
                </div>

                {showSettlementDateField && (
                  <div className="mt-4 grid gap-3 lg:max-w-sm">
                    <label>
                      <span className={labelClass}>{t('journal.settlementDate')}</span>
                      <input
                        className={input}
                        type="date"
                        value={form.settlementDate}
                        onChange={(event) => handleSettlementDateChange(event.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="col-span-full flex flex-wrap items-center gap-3">
                <button
                  className={btnPrimary}
                  type="submit"
                  disabled={
                    !canSubmit || createTransactionMutation.isPending || updateTransactionMutation.isPending
                  }
                >
                  {createTransactionMutation.isPending || updateTransactionMutation.isPending
                    ? t('common.saving')
                    : editingTransactionId
                      ? t('journal.saveChanges')
                      : t('journal.addTransaction')}
                </button>

                <button type="button" className={btnSecondary} onClick={closeComposer}>
                  {editingTransactionId ? t('journal.cancelEdit') : t('journal.closeEditor')}
                </button>
              </div>
              {(createTransactionMutation.error || updateTransactionMutation.error) && (
                <p className="col-span-full text-sm text-red-400">
                  {createTransactionMutation.error?.message ?? updateTransactionMutation.error?.message}
                </p>
              )}
            </form>
          </div>
        </Modal>
      </div>

      <section className={card}>
        <SectionHeader
          eyebrow={t('journal.reviewEyebrow')}
          title={t('journal.reviewTitle')}
          description={t('journal.reviewDescription')}
          className="mb-4"
        />

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="flex-1 min-w-[200px]">
            <span className={labelClass}>{t('journal.search')}</span>
            <input
              className={filterInput}
              value={journalFilters.search}
              onChange={(event) => updateJournalFilter('search', event.target.value)}
              placeholder={t('journal.searchPlaceholder')}
            />
          </label>

          <label>
            <span className={labelClass}>{t('journal.filterAccount')}</span>
            <select
              className={filterInput}
              value={journalFilters.accountId}
              onChange={(event) => updateJournalFilter('accountId', event.target.value)}
            >
              <option value="ALL">{t('journal.allAccounts')}</option>
              {sortedAccountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>{t('journal.filterInstrument')}</span>
            <select
              className={filterInput}
              value={journalFilters.instrumentId}
              onChange={(event) => updateJournalFilter('instrumentId', event.target.value)}
            >
              <option value="ALL">{t('journal.allInstruments')}</option>
              {sortedInstrumentOptions.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>{t('journal.filterType')}</span>
            <select
              className={filterInput}
              value={journalFilters.type}
              onChange={(event) => updateJournalFilter('type', event.target.value)}
            >
              <option value="ALL">{t('journal.allTypes')}</option>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {labelTransactionType(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>{t('journal.filterCurrency')}</span>
            <select
              className={filterInput}
              value={journalFilters.currency}
              onChange={(event) => updateJournalFilter('currency', event.target.value)}
            >
              <option value="ALL">{t('journal.allCurrencies')}</option>
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>{t('journal.sort')}</span>
            <select
              className={filterInput}
              value={journalFilters.sort}
              onChange={(event) => updateJournalFilter('sort', event.target.value)}
            >
              <option value="tradeDate-desc">{t('journal.sortTradeDateDesc')}</option>
              <option value="tradeDate-asc">{t('journal.sortTradeDateAsc')}</option>
              <option value="grossAmount-desc">{t('journal.sortGrossAmountDesc')}</option>
              <option value="grossAmount-asc">{t('journal.sortGrossAmountAsc')}</option>
              <option value="type-asc">{t('journal.sortTypeAsc')}</option>
              <option value="account-asc">{t('journal.sortAccountAsc')}</option>
              <option value="createdAt-desc">{t('journal.sortCreatedAtDesc')}</option>
            </select>
          </label>

          {hasActiveJournalFilters && (
            <button type="button" className={btnGhost} onClick={resetJournalFilters}>
              {t('journal.resetFilters')}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-zinc-500 mb-4">
          <span>
            {isPolish
              ? `Wyświetlono ${pagedRows.length} z ${sortedRows.length} pasujących wierszy (${journalRows.length} łącznie).`
              : `Showing ${pagedRows.length} of ${sortedRows.length} matching rows (${journalRows.length} total).`}
          </span>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <span>{t('journal.rows')}</span>
              <select
                className={filterInput}
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
              className={btnSecondary}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
            >
              {t('journal.previous')}
            </button>
            <span>
              {isPolish ? `Strona ${currentPage} / ${totalPages}` : `Page ${currentPage} / ${totalPages}`}
            </span>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
            >
              {t('journal.next')}
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {transactions.length === 0 && (
          <EmptyState
            title={t('journal.noTransactionsTitle')}
            description={t('journal.noTransactionsDescription')}
            action={{
              label: t('journal.addTransaction'),
              onClick: openComposerForCreate,
            }}
          />
        )}
        {transactions.length !== 0 && pagedRows.length === 0 && (
          <EmptyState
            title={t('journal.noMatchesTitle')}
            description={t('journal.noMatchesDescription')}
            action={{
              label: t('journal.resetFilters'),
              onClick: resetJournalFilters,
            }}
          />
        )}
        {pagedRows.map(({ transaction, accountName, instrumentName, instrumentSymbol }) => (
          <article className="rounded-lg border border-zinc-800/50 bg-zinc-900 p-4 space-y-2" key={transaction.id}>
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`${badge} ${txBadgeVariants[transaction.type as keyof typeof txBadgeVariants] ?? ''}`}>
                    {labelTransactionType(transaction.type)}
                  </span>
                  <strong className="text-sm font-medium text-zinc-100">
                    {instrumentName ?? accountName}
                  </strong>
                </div>
                <strong className="text-sm font-medium tabular-nums text-zinc-100">
                  {formatCurrency(transaction.grossAmount, transaction.currency)}
                </strong>
              </div>

              <p className="text-sm text-zinc-400 mt-1">
                {accountName}
                {instrumentSymbol ? ` · ${instrumentSymbol}` : ''}
                {isPolish ? ` · transakcja ${formatDate(transaction.tradeDate)}` : ` · trade ${formatDate(transaction.tradeDate)}`}
                {transaction.settlementDate
                  ? isPolish
                    ? ` · rozliczenie ${formatDate(transaction.settlementDate)}`
                    : ` · settle ${formatDate(transaction.settlementDate)}`
                  : ''}
              </p>

              {transaction.notes ? <p className="text-sm text-zinc-500 italic">{transaction.notes}</p> : null}

              <p className="text-xs text-zinc-600">
                {t('journal.created')} {formatDate(transaction.createdAt)}
              </p>

              <div className="flex flex-wrap gap-2 mt-1">
                {transaction.quantity ? (
                  <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                    {t('journal.qtyBadge')} {formatNumber(transaction.quantity, { maximumFractionDigits: 0 })}
                  </span>
                ) : null}
                {transaction.unitPrice ? (
                  <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                    {t('journal.pxBadge')} {formatCurrency(transaction.unitPrice, transaction.currency)}
                  </span>
                ) : null}
                {Number(transaction.feeAmount) !== 0 ? (
                  <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                    {t('journal.feeBadge')} {formatCurrency(transaction.feeAmount, transaction.currency)}
                  </span>
                ) : null}
                {Number(transaction.taxAmount) !== 0 ? (
                  <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                    {t('journal.taxBadge')} {formatCurrency(transaction.taxAmount, transaction.currency)}
                  </span>
                ) : null}
                {transaction.fxRateToPln ? (
                  <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                    fx {formatNumber(transaction.fxRateToPln, { maximumFractionDigits: 6, minimumFractionDigits: 0 })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`${badge} bg-zinc-800 text-zinc-400`}>{transaction.id.slice(0, 8)}</span>
              <button type="button" className={btnSecondary} onClick={() => startEditing(transaction)}>
                {t('journal.edit')}
              </button>
              {pendingDeleteTransactionId !== transaction.id && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => requestDeleteTransaction(transaction.id)}
                  disabled={deleteTransactionMutation.isPending}
                >
                  {t('journal.delete')}
                </button>
              )}
            </div>
            {pendingDeleteTransactionId === transaction.id && (
              <DangerConfirmInline
                title={
                  isPolish
                    ? `Usunąć transakcję ${labelTransactionType(transaction.type)} z dnia ${transaction.tradeDate}?`
                    : `Delete transaction ${transaction.type} on ${transaction.tradeDate}?`
                }
                description={t('journal.deleteDescription')}
                confirmLabel={t('journal.deleteTransaction')}
                confirmPendingLabel={t('journal.deleting')}
                isPending={deleteTransactionMutation.isPending}
                onCancel={cancelDeleteTransaction}
                onConfirm={() => confirmDeleteTransaction(transaction.id)}
              />
            )}
          </article>
        ))}
        {deleteTransactionMutation.error && (
          <p className="text-sm text-red-400">{deleteTransactionMutation.error.message}</p>
        )}
      </div>
    </>
  )
}
