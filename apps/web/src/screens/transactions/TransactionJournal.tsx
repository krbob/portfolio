import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Account, Instrument, Transaction } from '../../api/write-model'
import type { CreateTransactionPayload, UpdateTransactionPayload } from '../../api/write-model'
import { usePortfolioHoldings } from '../../hooks/use-read-model'
import { useI18n } from '../../lib/i18n'
import type { TransactionComposerDraft, TransactionRouteState } from '../../lib/transaction-composer'
import {
  buildRedeemPreview,
  compareAccountsByDisplayOrder,
  compareEdoLotsByPurchaseDate,
  compareInstrumentsByName,
  compareJournalRows,
  initialForm,
  initialJournalFilters,
  multiplyDecimalInputs,
  normalizeDecimalForPayload,
  normalizeIntegerInput,
  normalizeOptionalDecimalForPayload,
  type JournalFilters,
  type JournalRow,
} from './transactions-helpers'
import { TransactionJournalComposer } from './journal/TransactionJournalComposer'
import { TransactionJournalReview } from './journal/TransactionJournalReview'
import { TransactionJournalSummary } from './journal/TransactionJournalSummary'

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
  const selectedRedeemLotsForComposer = useMemo(
    () =>
      selectedRedeemLots.map((lot) => ({
        purchaseDate: lot.purchaseDate,
        quantity: lot.quantity,
        costBasisPln: lot.costBasisPln,
        currentValuePln: lot.currentValuePln ?? null,
        unrealizedGainPln: lot.unrealizedGainPln ?? null,
        valuationIssue: lot.valuationIssue ?? null,
      })),
    [selectedRedeemLots],
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

  const submitErrorMessage = createTransactionMutation.error?.message ?? updateTransactionMutation.error?.message ?? null
  const deleteErrorMessage = deleteTransactionMutation.error?.message ?? null
  const holdingsErrorMessage = holdingsQuery.error?.message ?? null

  const openComposerWithDraft = useCallback((draft: TransactionComposerDraft | null) => {
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
  }, [instrumentOptions])

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
    openComposerWithDraft,
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
      fxRateToPln: form.currency === 'PLN' ? null : normalizeOptionalDecimalForPayload(form.fxRateToPln),
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

  function handleAccountChange(nextAccountId: string) {
    const selectedAccount = accountOptions.find((account) => account.id === nextAccountId)
    setForm((current) => {
      const nextCurrency = selectedAccount?.baseCurrency ?? current.currency
      return {
        ...current,
        accountId: nextAccountId,
        currency: nextCurrency,
        fxRateToPln: nextCurrency === 'PLN' ? '' : current.fxRateToPln,
      }
    })
  }

  function handleInstrumentChange(nextInstrumentId: string) {
    const selectedInstrument = instrumentOptions.find((instrument) => instrument.id === nextInstrumentId)
    setForm((current) => ({
      ...current,
      instrumentId: nextInstrumentId,
      unitPrice:
        selectedInstrument?.kind === 'BOND_EDO' && (current.unitPrice === '' || current.unitPrice === '0')
          ? '100'
          : current.unitPrice,
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

  function handleFeeAmountChange(nextFeeAmount: string) {
    setForm((current) => ({
      ...current,
      feeAmount: nextFeeAmount,
    }))
  }

  function handleTaxAmountChange(nextTaxAmount: string) {
    setForm((current) => ({
      ...current,
      taxAmount: nextTaxAmount,
    }))
  }

  function handleCurrencyChange(nextCurrency: string) {
    const normalizedCurrency = nextCurrency.toUpperCase()
    setForm((current) => ({
      ...current,
      currency: normalizedCurrency,
      fxRateToPln: normalizedCurrency === 'PLN' ? '' : current.fxRateToPln,
    }))
  }

  function handleFxRateChange(nextFxRateToPln: string) {
    setForm((current) => ({
      ...current,
      fxRateToPln: nextFxRateToPln,
    }))
  }

  function handleNotesChange(nextNotes: string) {
    setForm((current) => ({
      ...current,
      notes: nextNotes,
    }))
  }

  function updateJournalFilter(name: keyof JournalFilters, value: string) {
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
        <TransactionJournalSummary
          composerOpen={composerOpen}
          hasActiveJournalFilters={hasActiveJournalFilters}
          sortedRowCount={sortedRows.length}
          journalRowCount={journalRows.length}
          accountsInFilteredJournal={accountsInFilteredJournal}
          pagedRowCount={pagedRows.length}
          instrumentsInFilteredJournal={instrumentsInFilteredJournal}
          latestTradeDateInFilteredJournal={latestTradeDateInFilteredJournal}
          currentPage={currentPage}
          totalPages={totalPages}
          onToggleComposer={() => {
            if (composerOpen) {
              closeComposer()
            } else {
              openComposerForCreate()
            }
          }}
          onResetJournalFilters={resetJournalFilters}
        />

        <TransactionJournalComposer
          open={composerOpen}
          editingTransactionId={editingTransactionId}
          form={form}
          sortedAccountOptions={sortedAccountOptions}
          selectableInstrumentOptions={selectableInstrumentOptions}
          requiresInstrument={requiresInstrument}
          decimalSeparator={decimalSeparator}
          grossAmountMode={grossAmountMode}
          showSettlementDateField={showSettlementDateField}
          selectedRedeemLots={selectedRedeemLotsForComposer}
          redeemPreview={redeemPreview}
          isHoldingsLoading={holdingsQuery.isLoading}
          holdingsErrorMessage={holdingsErrorMessage}
          redeemableEdoHoldingsCount={redeemableEdoHoldings.length}
          hasSelectedRedeemHolding={selectedRedeemHolding != null}
          createPending={createTransactionMutation.isPending}
          updatePending={updateTransactionMutation.isPending}
          submitErrorMessage={submitErrorMessage}
          onClose={closeComposer}
          onSubmit={handleSubmit}
          onAccountChange={handleAccountChange}
          onTypeChange={handleTypeChange}
          onTradeDateChange={handleTradeDateChange}
          onInstrumentChange={handleInstrumentChange}
          onQuantityChange={handleQuantityChange}
          onUnitPriceChange={handleUnitPriceChange}
          onGrossAmountChange={handleGrossAmountChange}
          onApplySuggestedGrossAmount={applySuggestedGrossAmount}
          onFeeAmountChange={handleFeeAmountChange}
          onTaxAmountChange={handleTaxAmountChange}
          onCurrencyChange={handleCurrencyChange}
          onFxRateChange={handleFxRateChange}
          onNotesChange={handleNotesChange}
          onOpenSettlementDateField={openSettlementDateField}
          onResetSettlementDateToTradeDate={resetSettlementDateToTradeDate}
          onSettlementDateChange={handleSettlementDateChange}
        />
      </div>

      <TransactionJournalReview
        transactions={transactions}
        pagedRows={pagedRows}
        sortedRows={sortedRows}
        journalRowsCount={journalRows.length}
        sortedAccountOptions={sortedAccountOptions}
        sortedInstrumentOptions={sortedInstrumentOptions}
        journalFilters={journalFilters}
        currencyOptions={currencyOptions}
        currentPage={currentPage}
        totalPages={totalPages}
        pendingDeleteTransactionId={pendingDeleteTransactionId}
        deletePending={deleteTransactionMutation.isPending}
        deleteErrorMessage={deleteErrorMessage}
        onUpdateJournalFilter={updateJournalFilter}
        onResetJournalFilters={resetJournalFilters}
        onSetCurrentPage={setCurrentPage}
        onOpenComposerForCreate={openComposerForCreate}
        onStartEditing={startEditing}
        onRequestDeleteTransaction={requestDeleteTransaction}
        onCancelDeleteTransaction={cancelDeleteTransaction}
        onConfirmDeleteTransaction={confirmDeleteTransaction}
      />
    </>
  )
}
