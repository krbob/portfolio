import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DangerConfirmInline } from './DangerConfirmInline'
import { ImportAuditPanel } from './ImportAuditPanel'
import { Card, EmptyState, ErrorState, LoadingState, SectionHeader } from './ui'
import { Modal } from './ui/Modal'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import { getActiveUiLanguage, useI18n } from '../lib/i18n'
import { labelAuditOutcome, labelImportRowStatus, labelTransactionType } from '../lib/labels'
import {
  badge,
  btnGhost,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  filterInput,
  input,
  label as labelClass,
  txBadgeVariants,
} from '../lib/styles'
import {
  useAccounts,
  useCreateTransaction,
  useCreateTransactionImportProfile,
  useDeleteTransaction,
  useDeleteTransactionImportProfile,
  useImportTransactions,
  useImportTransactionsCsv,
  useInstruments,
  usePreviewTransactionsImport,
  usePreviewTransactionsCsvImport,
  useTransactionImportProfiles,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransactionImportProfile,
} from '../hooks/use-write-model'
import type {
  ImportTransactionsPayload,
  ImportTransactionsPreviewResult,
  SaveTransactionImportProfilePayload,
  Transaction,
  TransactionImportProfile,
} from '../api/write-model'

const today = new Date().toISOString().slice(0, 10)
const transactionTypes = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'REDEEM', 'FEE', 'TAX', 'INTEREST', 'CORRECTION'] as const
const NEW_IMPORT_PROFILE_ID = '__new_import_profile__'
const STRUCTURED_IMPORT_TEMPLATE = `[
  {
    "accountId": "00000000-0000-0000-0000-000000000001",
    "instrumentId": "00000000-0000-0000-0000-000000000002",
    "type": "BUY",
    "tradeDate": "2026-03-18",
    "settlementDate": "2026-03-20",
    "quantity": "2",
    "unitPrice": "123.45",
    "grossAmount": "246.90",
    "feeAmount": "1.20",
    "taxAmount": "0",
    "currency": "EUR",
    "fxRateToPln": "4.2711",
    "notes": "Canonical JSON import"
  }
]`

const initialForm = {
  accountId: '',
  instrumentId: '',
  type: 'DEPOSIT',
  tradeDate: today,
  settlementDate: today,
  quantity: '',
  unitPrice: '',
  grossAmount: '',
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

type ImportMappingField =
  | 'account'
  | 'type'
  | 'tradeDate'
  | 'settlementDate'
  | 'instrument'
  | 'quantity'
  | 'unitPrice'
  | 'grossAmount'
  | 'feeAmount'
  | 'taxAmount'
  | 'currency'
  | 'fxRateToPln'
  | 'notes'

interface ImportProfileFormState {
  name: string
  description: string
  delimiter: string
  dateFormat: string
  decimalSeparator: string
  skipDuplicatesByDefault: boolean
  headerMappings: Record<ImportMappingField, string>
  defaults: {
    accountId: string
    currency: string
  }
}

interface JournalRow {
  transaction: Transaction
  accountName: string
  instrumentName: string | null
  instrumentSymbol: string | null
}

type TransactionsWorkspace = 'journal' | 'import' | 'profiles'
type ImportBatchMode = 'csv' | 'structured'
type ImportPreviewStatusFilter =
  | 'ALL'
  | 'IMPORTABLE'
  | 'DUPLICATE_EXISTING'
  | 'DUPLICATE_BATCH'
  | 'INVALID'

const importMappingFields: Array<{
  key: ImportMappingField
  label: string
  placeholder: string
  required?: boolean
}> = [
  { key: 'account', label: 'Account column', placeholder: 'account' },
  { key: 'type', label: 'Type column', placeholder: 'type', required: true },
  { key: 'tradeDate', label: 'Trade date column', placeholder: 'tradeDate', required: true },
  { key: 'settlementDate', label: 'Settlement date column', placeholder: 'settlementDate' },
  { key: 'instrument', label: 'Instrument column', placeholder: 'instrument' },
  { key: 'quantity', label: 'Quantity column', placeholder: 'quantity' },
  { key: 'unitPrice', label: 'Unit price column', placeholder: 'unitPrice' },
  { key: 'grossAmount', label: 'Gross amount column', placeholder: 'grossAmount', required: true },
  { key: 'feeAmount', label: 'Fee column', placeholder: 'feeAmount' },
  { key: 'taxAmount', label: 'Tax column', placeholder: 'taxAmount' },
  { key: 'currency', label: 'Currency column', placeholder: 'currency' },
  { key: 'fxRateToPln', label: 'FX to PLN column', placeholder: 'fxRateToPln' },
  { key: 'notes', label: 'Notes column', placeholder: 'notes' },
]

export function TransactionsSection() {
  const { isPolish } = useI18n()
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const transactionImportProfilesQuery = useTransactionImportProfiles()
  const importEventsQuery = usePortfolioAuditEvents({ limit: 8, category: 'IMPORTS' })
  const createTransactionMutation = useCreateTransaction()
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()
  const createImportProfileMutation = useCreateTransactionImportProfile()
  const updateImportProfileMutation = useUpdateTransactionImportProfile()
  const deleteImportProfileMutation = useDeleteTransactionImportProfile()
  const previewTransactionsCsvImportMutation = usePreviewTransactionsCsvImport()
  const importTransactionsCsvMutation = useImportTransactionsCsv()
  const previewTransactionsImportMutation = usePreviewTransactionsImport()
  const importTransactionsMutation = useImportTransactions()
  const [form, setForm] = useState(initialForm)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [selectedImportProfileId, setSelectedImportProfileId] = useState<string | null>(null)
  const [pendingSavedImportProfile, setPendingSavedImportProfile] = useState<TransactionImportProfile | null>(null)
  const [importProfileForm, setImportProfileForm] = useState<ImportProfileFormState>(createInitialImportProfileForm)
  const [importCsv, setImportCsv] = useState('')
  const [importBatchMode, setImportBatchMode] = useState<ImportBatchMode>('csv')
  const [importSkipDuplicates, setImportSkipDuplicates] = useState(true)
  const [importSourceFileName, setImportSourceFileName] = useState('')
  const [importSourceLabel, setImportSourceLabel] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [importPreviewStatusFilter, setImportPreviewStatusFilter] =
    useState<ImportPreviewStatusFilter>('ALL')
  const [structuredImportJson, setStructuredImportJson] = useState('')
  const [structuredImportSkipDuplicates, setStructuredImportSkipDuplicates] = useState(true)
  const [structuredImportFeedback, setStructuredImportFeedback] = useState<string | null>(null)
  const [structuredImportError, setStructuredImportError] = useState<string | null>(null)
  const [structuredImportPreview, setStructuredImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [structuredImportPreviewStatusFilter, setStructuredImportPreviewStatusFilter] =
    useState<ImportPreviewStatusFilter>('ALL')
  const [importProfileFeedback, setImportProfileFeedback] = useState<string | null>(null)
  const [pendingDeleteImportProfileId, setPendingDeleteImportProfileId] = useState<string | null>(null)
  const [pendingDeleteTransactionId, setPendingDeleteTransactionId] = useState<string | null>(null)
  const [journalFilters, setJournalFilters] = useState(initialJournalFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeWorkspace, setActiveWorkspace] = useState<TransactionsWorkspace>('journal')
  const [showComposer, setShowComposer] = useState(false)
  const [showSettlementDateField, setShowSettlementDateField] = useState(false)
  const [hasCustomSettlementDate, setHasCustomSettlementDate] = useState(false)
  const [grossAmountMode, setGrossAmountMode] = useState<'auto' | 'manual'>('auto')

  const composerOpen = showComposer || editingTransactionId != null
  const requiresInstrument = form.type === 'BUY' || form.type === 'SELL' || form.type === 'REDEEM'
  const decimalSeparator = isPolish ? ',' : '.'
  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []
  const sortedAccountOptions = useMemo(
    () => [...accountOptions].sort(compareAccountsByDisplayOrder),
    [accountOptions],
  )
  const sortedInstrumentOptions = useMemo(
    () => [...instrumentOptions].sort(compareInstrumentsByName),
    [instrumentOptions],
  )
  const importProfiles = transactionImportProfilesQuery.data ?? []
  const localizedImportMappingFields = useMemo(
    () => getImportMappingFields(isPolish),
    [isPolish],
  )
  const hasWorkspaceData =
    accountsQuery.data != null ||
    instrumentsQuery.data != null ||
    transactionsQuery.data != null ||
    transactionImportProfilesQuery.data != null
  const workspaceError =
    accountsQuery.error ??
    instrumentsQuery.error ??
    transactionsQuery.error ??
    transactionImportProfilesQuery.error

  const selectedImportProfile = useMemo(
    () =>
      selectedImportProfileId && selectedImportProfileId !== NEW_IMPORT_PROFILE_ID
        ? importProfiles.find((profile) => profile.id === selectedImportProfileId) ??
          (pendingSavedImportProfile?.id === selectedImportProfileId ? pendingSavedImportProfile : null)
        : null,
    [importProfiles, pendingSavedImportProfile, selectedImportProfileId],
  )
  const selectedImportProfileSyncKey = selectedImportProfile
    ? `${selectedImportProfile.id}:${selectedImportProfile.updatedAt}`
    : selectedImportProfileId
  const importProfilePayload = useMemo(
    () => buildImportProfilePayload(importProfileForm),
    [importProfileForm],
  )
  const selectedImportProfilePayload = useMemo(
    () =>
      selectedImportProfile
        ? buildImportProfilePayload(importProfileToForm(selectedImportProfile))
        : null,
    [selectedImportProfile],
  )
  const importProfileDirty = useMemo(() => {
    if (selectedImportProfileId === NEW_IMPORT_PROFILE_ID) {
      return serializeImportProfilePayload(importProfilePayload) !== serializeImportProfilePayload(buildImportProfilePayload(createInitialImportProfileForm()))
    }
    if (selectedImportProfilePayload == null) {
      return false
    }
    return serializeImportProfilePayload(importProfilePayload) !== serializeImportProfilePayload(selectedImportProfilePayload)
  }, [importProfilePayload, selectedImportProfileId, selectedImportProfilePayload])
  const importProfileTemplate = useMemo(
    () => buildImportProfileTemplate(importProfileForm),
    [importProfileForm],
  )

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

  const journalRows = useMemo<JournalRow[]>(() => {
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

  const importProfileBlockingReason =
    selectedImportProfileId == null
      ? isPolish
        ? 'Ładowanie zapisanych profili importu.'
        : 'Loading saved import profiles.'
      : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
        ? isPolish
          ? 'Zapisz profil importu CSV przed podglądem albo importem.'
          : 'Save a CSV import profile before previewing or importing.'
        : selectedImportProfile == null
          ? isPolish
            ? 'Wybrany profil importu CSV nie jest już dostępny.'
            : 'Selected CSV import profile is no longer available.'
          : importProfileDirty
            ? isPolish
              ? 'Zapisz zmiany w profilu przed podglądem albo importem.'
              : 'Save profile changes before previewing or importing.'
            : null

  const importBlockedByPreview = Boolean(
    importPreview &&
      (importPreview.invalidRowCount > 0 || (!importSkipDuplicates && importPreview.duplicateRowCount > 0)),
  )
  const structuredImportBlockedByPreview = Boolean(
    structuredImportPreview &&
      (structuredImportPreview.invalidRowCount > 0 ||
        (!structuredImportSkipDuplicates && structuredImportPreview.duplicateRowCount > 0)),
  )
  const importEvents = importEventsQuery.data ?? []
  const latestImportEvent = importEvents[0] ?? null
  const visibleImportPreviewRows = useMemo(() => {
    if (importPreview == null || importPreviewStatusFilter === 'ALL') {
      return importPreview?.rows ?? []
    }

    return importPreview.rows.filter((row) => row.status === importPreviewStatusFilter)
  }, [importPreview, importPreviewStatusFilter])

  useEffect(() => {
    if (selectedImportProfileId === null) {
      setSelectedImportProfileId(importProfiles[0]?.id ?? NEW_IMPORT_PROFILE_ID)
    }
  }, [importProfiles, selectedImportProfileId])

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
    if (
      pendingSavedImportProfile &&
      (selectedImportProfileId !== pendingSavedImportProfile.id ||
        importProfiles.some((profile) => profile.id === pendingSavedImportProfile.id))
    ) {
      setPendingSavedImportProfile(null)
    }
  }, [importProfiles, pendingSavedImportProfile, selectedImportProfileId])

  useEffect(() => {
    if (selectedImportProfileId === NEW_IMPORT_PROFILE_ID) {
      const nextForm = createInitialImportProfileForm()
      setImportProfileForm(nextForm)
      setImportSkipDuplicates(nextForm.skipDuplicatesByDefault)
      return
    }
    if (selectedImportProfile) {
      const nextForm = importProfileToForm(selectedImportProfile)
      setImportProfileForm(nextForm)
      setImportSkipDuplicates(nextForm.skipDuplicatesByDefault)
    }
  }, [selectedImportProfileSyncKey])

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
    setImportPreviewStatusFilter('ALL')
  }, [
    importCsv,
    importSkipDuplicates,
    importSourceFileName,
    importSourceLabel,
    selectedImportProfileId,
    importProfileDirty,
  ])

  useEffect(() => {
    setStructuredImportFeedback(null)
    setStructuredImportError(null)
    setStructuredImportPreview(null)
    setStructuredImportPreviewStatusFilter('ALL')
  }, [structuredImportJson, structuredImportSkipDuplicates])

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
    setActiveWorkspace('journal')
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
    setActiveWorkspace('journal')
    setPendingDeleteTransactionId(null)
    setEditingTransactionId(null)
    setShowSettlementDateField(false)
    setHasCustomSettlementDate(false)
    setGrossAmountMode('auto')
    setForm(initialForm)
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
      quantity: nextQuantity,
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

  function updateImportProfileField(name: keyof Omit<ImportProfileFormState, 'headerMappings' | 'defaults'>, value: string | boolean) {
    setImportProfileFeedback(null)
    setImportProfileForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function updateImportProfileMapping(name: ImportMappingField, value: string) {
    setImportProfileFeedback(null)
    setImportProfileForm((current) => ({
      ...current,
      headerMappings: {
        ...current.headerMappings,
        [name]: value,
      },
    }))
  }

  function updateImportProfileDefault(name: keyof ImportProfileFormState['defaults'], value: string) {
    setImportProfileFeedback(null)
    setImportProfileForm((current) => ({
      ...current,
      defaults: {
        ...current.defaults,
        [name]: value,
      },
    }))
  }

  function handleCreateNewImportProfile() {
    setImportProfileFeedback(null)
    setPendingDeleteImportProfileId(null)
    setPendingSavedImportProfile(null)
    setSelectedImportProfileId(NEW_IMPORT_PROFILE_ID)
    setActiveWorkspace('profiles')
  }

  function handleImportProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = buildImportProfilePayload(importProfileForm)
    setImportProfileFeedback(null)

    if (selectedImportProfileId && selectedImportProfileId !== NEW_IMPORT_PROFILE_ID) {
      updateImportProfileMutation.mutate(
        {
          id: selectedImportProfileId,
          ...payload,
        },
        {
          onSuccess: (profile) => {
            setPendingSavedImportProfile(profile)
            setImportProfileFeedback(
              isPolish
                ? `Zaktualizowano profil importu "${profile.name}".`
                : `Updated import profile "${profile.name}".`,
            )
            setSelectedImportProfileId(profile.id)
            setImportProfileForm(importProfileToForm(profile))
            setImportSkipDuplicates(profile.skipDuplicatesByDefault)
          },
        },
      )
      return
    }

    createImportProfileMutation.mutate(payload, {
      onSuccess: (profile) => {
        setPendingSavedImportProfile(profile)
        setImportProfileFeedback(
          isPolish
            ? `Utworzono profil importu "${profile.name}".`
            : `Created import profile "${profile.name}".`,
        )
        setSelectedImportProfileId(profile.id)
        setImportProfileForm(importProfileToForm(profile))
        setImportSkipDuplicates(profile.skipDuplicatesByDefault)
      },
    })
  }

  function handleDeleteImportProfile() {
    if (!selectedImportProfile) {
      return
    }
    setPendingDeleteImportProfileId(selectedImportProfile.id)
  }

  function confirmDeleteImportProfile() {
    if (!selectedImportProfile) {
      return
    }

    const nextProfileId =
      importProfiles.find((profile) => profile.id !== selectedImportProfile.id)?.id ?? NEW_IMPORT_PROFILE_ID

    deleteImportProfileMutation.mutate(selectedImportProfile.id, {
      onSuccess: () => {
        setPendingSavedImportProfile(null)
        setPendingDeleteImportProfileId(null)
        setImportProfileFeedback(
          isPolish
            ? `Usunięto profil importu "${selectedImportProfile.name}".`
            : `Deleted import profile "${selectedImportProfile.name}".`,
        )
        setSelectedImportProfileId(nextProfileId)
      },
    })
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

  function handleImportPreview() {
    setImportFeedback(null)
    setImportError(null)

    if (selectedImportProfile == null) {
      setImportPreview(null)
      setImportError(
        importProfileBlockingReason ??
          (isPolish
            ? 'Zapisz profil importu CSV przed uruchomieniem podglądu.'
            : 'Save a CSV import profile before previewing.'),
      )
      return
    }

    previewTransactionsCsvImportMutation.mutate(
      {
        profileId: selectedImportProfile.id,
        csv: importCsv,
        skipDuplicates: importSkipDuplicates,
        sourceFileName: normalizeOptionalValue(importSourceFileName),
        sourceLabel: normalizeOptionalValue(importSourceLabel),
      },
      {
        onSuccess: (result) => {
          setImportPreview(result)
        },
        onError: (error) => {
          setImportPreview(null)
          setImportError(error.message)
        },
      },
    )
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setImportFeedback(null)
    setImportError(null)

    if (selectedImportProfile == null) {
      setImportError(
        importProfileBlockingReason ??
          (isPolish
            ? 'Zapisz profil importu CSV przed importem.'
            : 'Save a CSV import profile before importing.'),
      )
      return
    }

    importTransactionsCsvMutation.mutate(
      {
        profileId: selectedImportProfile.id,
        csv: importCsv,
        skipDuplicates: importSkipDuplicates,
        sourceFileName: normalizeOptionalValue(importSourceFileName),
        sourceLabel: normalizeOptionalValue(importSourceLabel),
      },
      {
        onSuccess: (result) => {
          setImportFeedback(buildImportResultMessage(result.createdCount, result.skippedDuplicateCount))
          setImportCsv('')
          setImportPreview(null)
        },
        onError: (error) => {
          setImportError(error.message)
        },
      },
    )
  }

  function handleStructuredImportPreview() {
    setStructuredImportFeedback(null)
    setStructuredImportError(null)

    try {
      const payload = parseStructuredImportPayload(structuredImportJson, structuredImportSkipDuplicates)
      previewTransactionsImportMutation.mutate(payload, {
        onSuccess: (result) => {
          setStructuredImportPreview(result)
        },
        onError: (error) => {
          setStructuredImportPreview(null)
          setStructuredImportError(error.message)
        },
      })
    } catch (error) {
      setStructuredImportPreview(null)
      setStructuredImportError(
        error instanceof Error ? error.message : isPolish ? 'Podgląd nie powiódł się.' : 'Preview failed.',
      )
    }
  }

  function handleStructuredImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStructuredImportFeedback(null)
    setStructuredImportError(null)

    try {
      const payload = parseStructuredImportPayload(structuredImportJson, structuredImportSkipDuplicates)
      importTransactionsMutation.mutate(payload, {
        onSuccess: (result) => {
          setStructuredImportFeedback(
            buildImportResultMessage(result.createdCount, result.skippedDuplicateCount),
          )
          setStructuredImportJson('')
          setStructuredImportPreview(null)
        },
        onError: (error) => {
          setStructuredImportError(error.message)
        },
      })
    } catch (error) {
      setStructuredImportError(
        error instanceof Error ? error.message : isPolish ? 'Import nie powiódł się.' : 'Import failed.',
      )
    }
  }

  function handleRetryWorkspace() {
    void Promise.all([
      accountsQuery.refetch(),
      instrumentsQuery.refetch(),
      transactionsQuery.refetch(),
      transactionImportProfilesQuery.refetch(),
      importEventsQuery.refetch(),
    ])
  }

  if (
    !hasWorkspaceData &&
    (accountsQuery.isLoading ||
      instrumentsQuery.isLoading ||
      transactionsQuery.isLoading ||
      transactionImportProfilesQuery.isLoading)
  ) {
    return (
      <LoadingState
        title={isPolish ? 'Ładowanie obszaru transakcji' : 'Loading transactions workspace'}
        description={
          isPolish
            ? 'Pobieranie kont, instrumentów, wierszy dziennika i zapisanych profili importu.'
            : 'Fetching accounts, instruments, journal rows and saved import profiles.'
        }
        blocks={4}
      />
    )
  }

  if (!hasWorkspaceData && workspaceError) {
    return (
      <ErrorState
        title={isPolish ? 'Transakcje niedostępne' : 'Transactions unavailable'}
        description={
          isPolish
            ? 'Nie udało się załadować kanonicznego obszaru transakcji. Spróbuj ponownie albo sprawdź health w Ustawieniach.'
            : 'The canonical transaction workspace could not load. Retry now or verify runtime health in Settings.'
        }
        onRetry={handleRetryWorkspace}
      />
    )
  }

  if (accountOptions.length === 0) {
    return (
      <EmptyState
        title={isPolish ? 'Brak jeszcze kont' : 'No accounts available yet'}
        description={
          isPolish
            ? 'Utwórz konta maklerskie albo rejestry obligacji w Ustawieniach, zanim zaczniesz zapisywać transakcje.'
            : 'Create your brokerage or bond accounts in Settings before recording transactions.'
        }
        action={{ label: isPolish ? 'Przejdź do Ustawień' : 'Go to Settings', to: '/settings' }}
      />
    )
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow={isPolish ? 'Write model' : 'Write model'}
        title={isPolish ? 'Transakcje' : 'Transactions'}
        description={
          isPolish
            ? 'Trzymaj kanoniczny strumień zdarzeń w jednym miejscu, ale pracuj osobno na dzienniku, imporcie i profilach.'
            : 'Keep the canonical event stream in one place, but work through journal, import and profile flows separately.'
        }
        className="mb-2"
      />

      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Transakcje' : 'Transactions'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{journalRows.length}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Wiersze dziennika w widoku' : 'Journal rows in view'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{sortedRows.length}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Zapisane profile' : 'Saved profiles'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{importProfiles.length}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Ostatnie zdarzenie importu' : 'Latest import event'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">
            {latestImportEvent ? labelAuditOutcome(latestImportEvent.outcome) : isPolish ? 'n/d' : 'n/a'}
          </strong>
        </article>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="tablist" aria-label={isPolish ? 'Obszar transakcji' : 'Transactions workspace'}>
          {([
            ['journal', isPolish ? 'Dziennik' : 'Journal'],
            ['import', isPolish ? 'Import' : 'Import'],
            ['profiles', isPolish ? 'Profile' : 'Profiles'],
          ] as const).map(([workspace, wsLabel]) => (
            <button
              key={workspace}
              id={`transactions-workspace-tab-${workspace}`}
              type="button"
              role="tab"
              aria-selected={workspace === activeWorkspace}
              aria-controls={`transactions-workspace-panel-${workspace}`}
              tabIndex={workspace === activeWorkspace ? 0 : -1}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${workspace === activeWorkspace ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}
              onClick={() => setActiveWorkspace(workspace)}
            >
              {wsLabel}
            </button>
          ))}
        </div>
      </div>

      {activeWorkspace === 'journal' && (
        <div
          className="space-y-4"
          role="tabpanel"
          id="transactions-workspace-panel-journal"
          aria-labelledby="transactions-workspace-tab-journal"
        >
          <Card as="section" className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <SectionHeader
                eyebrow={isPolish ? 'Dziennik' : 'Journal'}
                title={isPolish ? 'Kanoniczny dziennik transakcji' : 'Canonical transaction journal'}
                description={
                  isPolish
                    ? 'Najpierw przeglądaj i filtruj zdarzenia, a formularz otwieraj dopiero wtedy, gdy chcesz dodać lub poprawić konkretny wiersz.'
                    : 'Review and filter events first, then open the composer only when you need to add or correct a row.'
                }
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
                  {composerOpen
                    ? isPolish
                      ? 'Zamknij edytor'
                      : 'Close editor'
                    : isPolish
                      ? 'Nowa transakcja'
                      : 'New transaction'}
                </button>
                {hasActiveJournalFilters && (
                  <button type="button" className={btnGhost} onClick={resetJournalFilters}>
                    {isPolish ? 'Wyczyść filtry' : 'Clear filters'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <JournalSummaryTile
                label={isPolish ? 'Wiersze w widoku' : 'Rows in view'}
                value={sortedRows.length.toString()}
                hint={isPolish ? `${journalRows.length} łącznie` : `${journalRows.length} total`}
              />
              <JournalSummaryTile
                label={isPolish ? 'Konta w widoku' : 'Accounts in view'}
                value={accountsInFilteredJournal.toString()}
                hint={isPolish ? `${pagedRows.length} na tej stronie` : `${pagedRows.length} on this page`}
              />
              <JournalSummaryTile
                label={isPolish ? 'Instrumenty w widoku' : 'Instruments in view'}
                value={instrumentsInFilteredJournal.toString()}
                hint={
                  hasActiveJournalFilters
                    ? isPolish
                      ? 'po aktywnych filtrach'
                      : 'after filters'
                    : isPolish
                      ? 'bez zawężeń'
                      : 'no filters'
                }
              />
              <JournalSummaryTile
                label={isPolish ? 'Ostatnia data transakcji' : 'Latest trade date'}
                value={
                  latestTradeDateInFilteredJournal
                    ? formatDate(latestTradeDateInFilteredJournal)
                    : isPolish
                      ? 'b/d'
                      : 'n/a'
                }
                hint={isPolish ? `Strona ${currentPage} / ${totalPages}` : `Page ${currentPage} / ${totalPages}`}
              />
            </div>
          </Card>

          <Modal
            open={composerOpen}
            onClose={closeComposer}
            title={
              editingTransactionId
                ? isPolish
                  ? 'Edytuj transakcję'
                  : 'Edit transaction'
                : isPolish
                  ? 'Nowa transakcja'
                  : 'New transaction'
            }
            size="2xl"
          >
            <div className="space-y-5">
              <p className="text-sm text-zinc-400">
                {editingTransactionId
                  ? isPolish
                    ? 'Zapis od razu zaktualizuje dziennik, wycenę, historię, alokację i zwroty.'
                    : 'Saving will immediately update the journal, valuation, history, allocation and returns.'
                  : isPolish
                    ? 'Uzupełnij tylko pola potrzebne dla wybranego typu. Instrument i ilość są wymagane wyłącznie dla kupna, sprzedaży i wykupu.'
                    : 'Fill only the fields needed for the selected type. Instrument and quantity are required only for buys, sells and redemptions.'}
              </p>

              <form className="grid grid-cols-2 gap-3 lg:grid-cols-4" onSubmit={handleSubmit}>
                <label>
                  <span className={labelClass}>{isPolish ? 'Konto' : 'Account'}</span>
                  <select
                    className={input}
                    value={form.accountId}
                    onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
                    required
                  >
                    <option value="">{isPolish ? 'Wybierz konto' : 'Select account'}</option>
                    {sortedAccountOptions.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>{isPolish ? 'Typ' : 'Type'}</span>
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
                  <span className={labelClass}>{isPolish ? 'Data transakcji' : 'Trade date'}</span>
                  <input
                    className={input}
                    type="date"
                    value={form.tradeDate}
                    onChange={(event) => handleTradeDateChange(event.target.value)}
                    required
                  />
                </label>

                <label>
                  <span className={labelClass}>{isPolish ? 'Instrument' : 'Instrument'}</span>
                  <select
                    className={input}
                    value={form.instrumentId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, instrumentId: event.target.value }))
                    }
                    disabled={!requiresInstrument}
                  >
                    <option value="">{isPolish ? 'Nie wymagane' : 'Not required'}</option>
                    {sortedInstrumentOptions.map((instrument) => (
                      <option key={instrument.id} value={instrument.id}>
                        {instrument.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>{isPolish ? 'Liczba sztuk' : 'Quantity'}</span>
                  <input
                    className={input}
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(event) => handleQuantityChange(event.target.value)}
                    placeholder="10"
                    disabled={!requiresInstrument}
                  />
                </label>

                <label>
                  <span className={labelClass}>{isPolish ? 'Cena jednostkowa' : 'Unit price'}</span>
                  <input
                    className={input}
                    inputMode="decimal"
                    value={form.unitPrice}
                    onChange={(event) => handleUnitPriceChange(event.target.value)}
                    placeholder={isPolish ? '123,45' : '123.45'}
                    disabled={!requiresInstrument}
                  />
                </label>

                <div>
                  <label className={labelClass} htmlFor="transaction-gross-amount">
                    {isPolish ? 'Kwota brutto' : 'Gross amount'}
                  </label>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                    <span>
                      {grossAmountMode === 'auto' && requiresInstrument
                        ? isPolish
                          ? 'Liczona z ilości i ceny.'
                          : 'Calculated from quantity and price.'
                        : isPolish
                          ? 'Możesz nadpisać ręcznie.'
                          : 'You can override it manually.'}
                    </span>
                    {requiresInstrument && (
                      <button type="button" className={btnGhost} onClick={applySuggestedGrossAmount}>
                        {isPolish ? 'Przelicz' : 'Recalculate'}
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
                  <span className={labelClass}>{isPolish ? 'Prowizja' : 'Fee amount'}</span>
                  <input
                    className={input}
                    inputMode="decimal"
                    value={form.feeAmount}
                    onChange={(event) => setForm((current) => ({ ...current, feeAmount: event.target.value }))}
                    placeholder={isPolish ? '0,00' : '0.00'}
                  />
                </label>

                <label>
                  <span className={labelClass}>{isPolish ? 'Podatek' : 'Tax amount'}</span>
                  <input
                    className={input}
                    inputMode="decimal"
                    value={form.taxAmount}
                    onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))}
                    placeholder={isPolish ? '0,00' : '0.00'}
                  />
                </label>

                <label>
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
                </label>

                <label>
                  <span className={labelClass}>{isPolish ? 'Kurs FX do PLN' : 'FX rate to PLN'}</span>
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

                <label className="col-span-2">
                  <span className={labelClass}>{isPolish ? 'Notatki' : 'Notes'}</span>
                  <input
                    className={input}
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder={isPolish ? 'Opcjonalna notatka audytowa' : 'Optional audit note'}
                  />
                </label>

                <div className="col-span-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {isPolish ? 'Data rozliczenia' : 'Settlement date'}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {showSettlementDateField
                          ? isPolish
                            ? 'Użyj innej daty tylko wtedy, gdy rozliczenie faktycznie nastąpiło później niż transakcja.'
                            : 'Use a different date only when settlement actually happened later than the trade.'
                          : isPolish
                            ? 'Domyślnie data rozliczenia jest taka sama jak data transakcji.'
                            : 'Settlement date defaults to the trade date.'}
                      </p>
                    </div>

                    {showSettlementDateField ? (
                      <button type="button" className={btnGhost} onClick={resetSettlementDateToTradeDate}>
                        {isPolish ? 'Użyj daty transakcji' : 'Use trade date'}
                      </button>
                    ) : (
                      <button type="button" className={btnGhost} onClick={openSettlementDateField}>
                        {isPolish ? 'Ustaw inną datę' : 'Set another date'}
                      </button>
                    )}
                  </div>

                  {showSettlementDateField && (
                    <div className="mt-4 grid gap-3 lg:max-w-sm">
                      <label>
                        <span className={labelClass}>{isPolish ? 'Data rozliczenia' : 'Settlement date'}</span>
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
                      ? isPolish
                        ? 'Zapisywanie...'
                        : 'Saving...'
                      : editingTransactionId
                        ? isPolish
                          ? 'Zapisz zmiany'
                          : 'Save changes'
                        : isPolish
                          ? 'Dodaj transakcję'
                          : 'Add transaction'}
                  </button>

                  <button type="button" className={btnSecondary} onClick={closeComposer}>
                    {editingTransactionId
                      ? isPolish
                        ? 'Anuluj edycję'
                        : 'Cancel edit'
                      : isPolish
                        ? 'Zamknij edytor'
                        : 'Close editor'}
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
      )}

      {activeWorkspace === 'profiles' && (
        <section
          className={card}
          role="tabpanel"
          id="transactions-workspace-panel-profiles"
          aria-labelledby="transactions-workspace-tab-profiles"
        >
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isPolish ? 'Profile importu' : 'Import profiles'}</p>
            <h4 className="mt-1 text-lg font-semibold text-zinc-100">{isPolish ? 'Zapisane reguły parsowania CSV' : 'Saved CSV parsing rules'}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {isPolish
                ? 'Utrzymuj jeden profil na brokera albo format eksportu. Podgląd i import zawsze użyją ostatniej zapisanej wersji wybranego profilu.'
                : 'Keep one profile per broker or export format. Preview and import will always use the last saved version of the selected profile.'}
            </p>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label>
              <span className={labelClass}>{isPolish ? 'Zapisany profil' : 'Saved profile'}</span>
              <select
                className={filterInput}
                value={selectedImportProfileId ?? ''}
                onChange={(event) => {
                  setImportProfileFeedback(null)
                  setPendingDeleteImportProfileId(null)
                  setSelectedImportProfileId(event.target.value)
                }}
              >
                {selectedImportProfileId === null && <option value="">{isPolish ? 'Ładowanie profili...' : 'Loading profiles...'}</option>}
                {importProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
                <option value={NEW_IMPORT_PROFILE_ID}>{isPolish ? 'Nowy profil' : 'New profile'}</option>
              </select>
            </label>

            <div className="flex items-center gap-3">
              <button type="button" className={btnSecondary} onClick={handleCreateNewImportProfile}>
                {isPolish ? 'Nowy profil' : 'New profile'}
              </button>
              <button
                type="button"
                className={btnDanger}
                onClick={handleDeleteImportProfile}
                disabled={selectedImportProfile == null || deleteImportProfileMutation.isPending}
              >
                {deleteImportProfileMutation.isPending
                  ? isPolish
                    ? 'Usuwanie...'
                    : 'Deleting...'
                  : isPolish
                    ? 'Usuń profil'
                    : 'Delete profile'}
              </button>
            </div>
          </div>

          {selectedImportProfile && pendingDeleteImportProfileId === selectedImportProfile.id && (
            <DangerConfirmInline
              title={isPolish ? `Usunąć profil "${selectedImportProfile.name}"?` : `Delete profile "${selectedImportProfile.name}"?`}
              description={
                isPolish
                  ? 'To usuwa zapisane reguły parsowania z serwera. Już zaimportowane transakcje pozostają bez zmian.'
                  : 'This removes the saved parsing rules from the server. Existing imported transactions stay untouched.'
              }
              confirmLabel={isPolish ? 'Usuń profil' : 'Delete profile'}
              confirmPendingLabel={isPolish ? 'Usuwanie...' : 'Deleting...'}
              isPending={deleteImportProfileMutation.isPending}
              onCancel={() => setPendingDeleteImportProfileId(null)}
              onConfirm={confirmDeleteImportProfile}
            />
          )}

          <form className="grid grid-cols-2 gap-3 mt-4 lg:grid-cols-4" onSubmit={handleImportProfileSubmit}>
            <label>
              <span className={labelClass}>{isPolish ? 'Nazwa' : 'Name'}</span>
              <input
                className={input}
                value={importProfileForm.name}
                onChange={(event) => updateImportProfileField('name', event.target.value)}
                placeholder={isPolish ? 'Eksport aktywności IBKR' : 'IBKR activity export'}
                required
              />
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Opis' : 'Description'}</span>
              <input
                className={input}
                value={importProfileForm.description}
                onChange={(event) => updateImportProfileField('description', event.target.value)}
                placeholder={isPolish ? 'Eksport średnikiem z europejskimi separatorami dziesiętnymi' : 'Semicolon export with European decimals'}
              />
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Separator pól' : 'Delimiter'}</span>
              <select
                className={input}
                value={importProfileForm.delimiter}
                onChange={(event) => updateImportProfileField('delimiter', event.target.value)}
              >
                <option value="COMMA">{isPolish ? 'Przecinek' : 'Comma'}</option>
                <option value="SEMICOLON">{isPolish ? 'Średnik' : 'Semicolon'}</option>
                <option value="TAB">Tab</option>
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Format daty' : 'Date format'}</span>
              <select
                className={input}
                value={importProfileForm.dateFormat}
                onChange={(event) => updateImportProfileField('dateFormat', event.target.value)}
              >
                <option value="ISO_LOCAL_DATE">YYYY-MM-DD</option>
                <option value="DMY_DOTS">DD.MM.YYYY</option>
                <option value="DMY_SLASH">DD/MM/YYYY</option>
                <option value="MDY_SLASH">MM/DD/YYYY</option>
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Separator dziesiętny' : 'Decimal separator'}</span>
              <select
                className={input}
                value={importProfileForm.decimalSeparator}
                onChange={(event) => updateImportProfileField('decimalSeparator', event.target.value)}
              >
                <option value="DOT">{isPolish ? 'Kropka' : 'Dot'}</option>
                <option value="COMMA">{isPolish ? 'Przecinek' : 'Comma'}</option>
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Domyślne konto' : 'Default account'}</span>
              <select
                className={input}
                value={importProfileForm.defaults.accountId}
                onChange={(event) => updateImportProfileDefault('accountId', event.target.value)}
              >
                <option value="">{isPolish ? 'CSV zawiera kolumnę konta' : 'CSV provides account column'}</option>
                {sortedAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Domyślna waluta' : 'Default currency'}</span>
              <input
                className={input}
                value={importProfileForm.defaults.currency}
                onChange={(event) => updateImportProfileDefault('currency', event.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
              />
            </label>

            <label className="flex items-start gap-3 col-span-full">
              <input
                type="checkbox"
                className="accent-blue-500 mt-1"
                checked={importProfileForm.skipDuplicatesByDefault}
                onChange={(event) => updateImportProfileField('skipDuplicatesByDefault', event.target.checked)}
              />
              <div>
                <span className={labelClass}>{isPolish ? 'Domyślnie pomijaj duplikaty' : 'Skip duplicates by default'}</span>
                <p className="text-sm text-zinc-500">
                  {isPolish
                    ? 'Używane do domyślnego ustawienia checkboxa importu dla tego profilu.'
                    : 'Used to prefill the import checkbox for this profile.'}
                </p>
              </div>
            </label>

            <div className="col-span-full">
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isPolish ? 'Mapowanie nagłówków' : 'Header mappings'}</p>
                <h5 className="mt-1 text-sm font-semibold text-zinc-100">{isPolish ? 'Dopasuj kolumny CSV do kanonicznych pól transakcji' : 'Match CSV columns to canonical transaction fields'}</h5>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {localizedImportMappingFields.map((field) => (
                  <label key={field.key}>
                    <span className={labelClass}>{field.label}</span>
                    <input
                      className={input}
                      value={importProfileForm.headerMappings[field.key]}
                      onChange={(event) => updateImportProfileMapping(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.required && (
                      <small className="text-xs text-zinc-600">
                        {isPolish ? 'Wymagane przez parser backendu.' : 'Required by the backend parser.'}
                      </small>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="col-span-full">
              <div className="mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isPolish ? 'Podgląd szablonu' : 'Template preview'}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {isPolish
                    ? 'Przykładowy nagłówek i jeden wiersz wygenerowany z bieżącego formularza profilu.'
                    : 'Sample header and one example row generated from the current profile form.'}
                </p>
              </div>
              <pre className="mt-2 rounded-lg bg-zinc-800 p-3 text-xs text-zinc-400 font-mono overflow-x-auto">{importProfileTemplate}</pre>
            </div>

            <div className="col-span-full flex items-center gap-3">
              <button
                className={btnPrimary}
                type="submit"
                disabled={
                  importProfileForm.name.trim() === '' ||
                  createImportProfileMutation.isPending ||
                  updateImportProfileMutation.isPending
                }
              >
                {createImportProfileMutation.isPending || updateImportProfileMutation.isPending
                  ? isPolish
                    ? 'Zapisywanie...'
                    : 'Saving...'
                  : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
                    ? isPolish
                      ? 'Utwórz profil'
                      : 'Create profile'
                    : isPolish
                      ? 'Zapisz profil'
                      : 'Save profile'}
              </button>
            </div>

            {importProfileFeedback && <p className="col-span-full text-sm text-zinc-500">{importProfileFeedback}</p>}
            {(transactionImportProfilesQuery.error ||
              createImportProfileMutation.error ||
              updateImportProfileMutation.error ||
              deleteImportProfileMutation.error) && (
              <p className="col-span-full text-sm text-red-400">
                {transactionImportProfilesQuery.error?.message ??
                  createImportProfileMutation.error?.message ??
                  updateImportProfileMutation.error?.message ??
                  deleteImportProfileMutation.error?.message}
              </p>
            )}
          </form>
        </section>
      )}

      {activeWorkspace === 'import' && (
        <section
          className={card}
          role="tabpanel"
          id="transactions-workspace-panel-import"
          aria-labelledby="transactions-workspace-tab-import"
        >
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isPolish ? 'Import paczki' : 'Batch import'}</p>
            <h4 className="mt-1 text-lg font-semibold text-zinc-100">{isPolish ? 'Podgląd i import paczek transakcji' : 'Preview and import transaction batches'}</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {isPolish
                ? 'Użyj zapisanych profili CSV dla eksportów od brokera albo wyślij kanoniczne paczki JSON bezpośrednio na endpoint importu transakcji.'
                : 'Use saved CSV profiles for broker exports or post canonical JSON batches directly against the transaction import endpoint.'}
            </p>
          </div>

          <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="tablist" aria-label={isPolish ? 'Tryb importu paczki' : 'Import batch mode'}>
            {([
              ['csv', isPolish ? 'CSV z profilem' : 'CSV with profile'],
              ['structured', isPolish ? 'Strukturalny JSON' : 'Structured JSON'],
            ] as const).map(([mode, modeLabel]) => (
              <button
                key={mode}
                id={`transactions-import-mode-tab-${mode}`}
                type="button"
                role="tab"
                aria-selected={mode === importBatchMode}
                aria-controls={`transactions-import-mode-panel-${mode}`}
                tabIndex={mode === importBatchMode ? 0 : -1}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === importBatchMode ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}
                onClick={() => setImportBatchMode(mode)}
              >
                {modeLabel}
              </button>
            ))}
          </div>

          {importBatchMode === 'csv' && (
            <form
              className="space-y-4"
              onSubmit={handleImportSubmit}
              role="tabpanel"
              id="transactions-import-mode-panel-csv"
              aria-labelledby="transactions-import-mode-tab-csv"
            >
              <div>
                <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                  {selectedImportProfile
                    ? selectedImportProfile.name
                    : isPolish
                      ? 'Nie wybrano zapisanego profilu'
                      : 'No saved profile selected'}
                </span>
                {importProfileBlockingReason && <p className="text-sm text-zinc-500 mt-1">{importProfileBlockingReason}</p>}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex-1 min-w-[200px]">
                  <span className={labelClass}>{isPolish ? 'Plik źródłowy' : 'Source file'}</span>
                  <input
                    className={filterInput}
                    value={importSourceFileName}
                    onChange={(event) => setImportSourceFileName(event.target.value)}
                    placeholder="ibkr-activity-2026-03.csv"
                  />
                </label>
                <label className="flex-1 min-w-[200px]">
                  <span className={labelClass}>{isPolish ? 'Etykieta źródła' : 'Source label'}</span>
                  <input
                    className={filterInput}
                    value={importSourceLabel}
                    onChange={(event) => setImportSourceLabel(event.target.value)}
                    placeholder={isPolish ? 'Eksport IBKR marzec 2026' : 'IBKR March 2026 export'}
                  />
                </label>
              </div>

              <textarea
                className="min-h-[200px] w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                value={importCsv}
                onChange={(event) => setImportCsv(event.target.value)}
                placeholder={importProfileTemplate}
              />

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="accent-blue-500"
                  checked={importSkipDuplicates}
                  onChange={(event) => setImportSkipDuplicates(event.target.checked)}
                  disabled={selectedImportProfile == null}
                />
                <span>{isPolish ? 'Pomijaj duplikaty podczas importu' : 'Skip duplicate rows during import'}</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={handleImportPreview}
                  disabled={
                    previewTransactionsCsvImportMutation.isPending ||
                    importCsv.trim() === '' ||
                    importProfileBlockingReason !== null
                  }
                >
                  {previewTransactionsCsvImportMutation.isPending
                    ? isPolish
                      ? 'Przygotowywanie podglądu...'
                      : 'Previewing...'
                    : isPolish
                      ? 'Podgląd importu'
                      : 'Preview import'}
                </button>
                <button
                  className={btnPrimary}
                  type="submit"
                  disabled={
                    importTransactionsCsvMutation.isPending ||
                    previewTransactionsCsvImportMutation.isPending ||
                    importCsv.trim() === '' ||
                    importBlockedByPreview ||
                    importProfileBlockingReason !== null
                  }
                >
                  {importTransactionsCsvMutation.isPending
                    ? isPolish
                      ? 'Importowanie...'
                      : 'Importing...'
                    : isPolish
                      ? 'Importuj CSV'
                      : 'Import CSV'}
                </button>
              </div>

              {importPreview && (
                <ImportPreviewPanel
                  preview={importPreview}
                  skipDuplicates={importSkipDuplicates}
                  statusFilter={importPreviewStatusFilter}
                  onStatusFilterChange={setImportPreviewStatusFilter}
                  rows={visibleImportPreviewRows}
                />
              )}

              {importFeedback && <p className="text-sm text-zinc-500">{importFeedback}</p>}
              {(importError || previewTransactionsCsvImportMutation.error || importTransactionsCsvMutation.error) && (
                <p className="text-sm text-red-400">
                  {importError ??
                    previewTransactionsCsvImportMutation.error?.message ??
                    importTransactionsCsvMutation.error?.message}
                </p>
              )}
            </form>
          )}

          {importBatchMode === 'structured' && (
            <form
              className="space-y-4"
              onSubmit={handleStructuredImportSubmit}
              role="tabpanel"
              id="transactions-import-mode-panel-structured"
              aria-labelledby="transactions-import-mode-tab-structured"
            >
              <div className="space-y-1">
                <p className="text-sm text-zinc-500">
                  {isPolish
                    ? 'Wklej albo kanoniczną tablicę JSON z wierszami transakcji, albo pełny payload importu z polem `rows`.'
                    : 'Paste either a canonical JSON array of transaction rows or a full import payload with `rows`.'}
                </p>
                <p className="text-sm text-zinc-500">
                  {isPolish
                    ? 'Ta ścieżka wywołuje bezpośrednio `/v1/transactions/import` i omija profile parsowania CSV.'
                    : 'This path calls `/v1/transactions/import` directly and bypasses CSV parsing profiles.'}
                </p>
              </div>

              <textarea
                className="min-h-[220px] w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                value={structuredImportJson}
                onChange={(event) => setStructuredImportJson(event.target.value)}
                placeholder={STRUCTURED_IMPORT_TEMPLATE}
              />

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="accent-blue-500"
                  checked={structuredImportSkipDuplicates}
                  onChange={(event) => setStructuredImportSkipDuplicates(event.target.checked)}
                />
                <span>{isPolish ? 'Pomijaj duplikaty podczas importu' : 'Skip duplicate rows during import'}</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={handleStructuredImportPreview}
                  disabled={previewTransactionsImportMutation.isPending || structuredImportJson.trim() === ''}
                >
                  {previewTransactionsImportMutation.isPending
                    ? isPolish
                      ? 'Przygotowywanie podglądu...'
                      : 'Previewing...'
                    : isPolish
                      ? 'Podgląd importu'
                      : 'Preview import'}
                </button>
                <button
                  className={btnPrimary}
                  type="submit"
                  disabled={
                    importTransactionsMutation.isPending ||
                    previewTransactionsImportMutation.isPending ||
                    structuredImportJson.trim() === '' ||
                    structuredImportBlockedByPreview
                  }
                >
                  {importTransactionsMutation.isPending
                    ? isPolish
                      ? 'Importowanie...'
                      : 'Importing...'
                    : isPolish
                      ? 'Importuj paczkę JSON'
                      : 'Import JSON batch'}
                </button>
              </div>

              {structuredImportPreview && (
                <ImportPreviewPanel
                  preview={structuredImportPreview}
                  skipDuplicates={structuredImportSkipDuplicates}
                  statusFilter={structuredImportPreviewStatusFilter}
                  onStatusFilterChange={setStructuredImportPreviewStatusFilter}
                  rows={structuredImportPreviewStatusFilter === 'ALL'
                    ? structuredImportPreview.rows
                    : structuredImportPreview.rows.filter((row) => row.status === structuredImportPreviewStatusFilter)}
                />
              )}

              {structuredImportFeedback && <p className="text-sm text-zinc-500">{structuredImportFeedback}</p>}
              {(structuredImportError || previewTransactionsImportMutation.error || importTransactionsMutation.error) && (
                <p className="text-sm text-red-400">
                  {structuredImportError ??
                    previewTransactionsImportMutation.error?.message ??
                    importTransactionsMutation.error?.message}
                </p>
              )}
            </form>
          )}
        </section>
      )}

      {activeWorkspace === 'journal' && (
        <section className={card}>
          <SectionHeader
            eyebrow={isPolish ? 'Przegląd' : 'Review'}
            title={isPolish ? 'Aktywny widok dziennika' : 'Active journal view'}
            description={
              isPolish
                ? 'Zawęź zdarzenia filtrami, a potem pracuj na pojedynczych wierszach bez rozpraszania całym formularzem.'
                : 'Narrow the event stream with filters, then work row by row without keeping the full composer open.'
            }
            className="mb-4"
          />

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <label className="flex-1 min-w-[200px]">
              <span className={labelClass}>{isPolish ? 'Szukaj' : 'Search'}</span>
              <input
                className={filterInput}
                value={journalFilters.search}
                onChange={(event) => updateJournalFilter('search', event.target.value)}
                placeholder={isPolish ? 'Typ, konto, instrument, notatka, kwota...' : 'Type, account, instrument, note, amount...'}
              />
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Konto' : 'Account'}</span>
              <select
                className={filterInput}
                value={journalFilters.accountId}
                onChange={(event) => updateJournalFilter('accountId', event.target.value)}
              >
                <option value="ALL">{isPolish ? 'Wszystkie konta' : 'All accounts'}</option>
                {sortedAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Instrument' : 'Instrument'}</span>
              <select
                className={filterInput}
                value={journalFilters.instrumentId}
                onChange={(event) => updateJournalFilter('instrumentId', event.target.value)}
              >
                <option value="ALL">{isPolish ? 'Wszystkie instrumenty' : 'All instruments'}</option>
                {sortedInstrumentOptions.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Typ' : 'Type'}</span>
              <select
                className={filterInput}
                value={journalFilters.type}
                onChange={(event) => updateJournalFilter('type', event.target.value)}
              >
                <option value="ALL">{isPolish ? 'Wszystkie typy' : 'All types'}</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {labelTransactionType(type)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Waluta' : 'Currency'}</span>
              <select
                className={filterInput}
                value={journalFilters.currency}
                onChange={(event) => updateJournalFilter('currency', event.target.value)}
              >
                <option value="ALL">{isPolish ? 'Wszystkie waluty' : 'All currencies'}</option>
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>{isPolish ? 'Sortowanie' : 'Sort'}</span>
              <select
                className={filterInput}
                value={journalFilters.sort}
                onChange={(event) => updateJournalFilter('sort', event.target.value)}
              >
                <option value="tradeDate-desc">{isPolish ? 'Data transakcji od najnowszych' : 'Trade date newest'}</option>
                <option value="tradeDate-asc">{isPolish ? 'Data transakcji od najstarszych' : 'Trade date oldest'}</option>
                <option value="grossAmount-desc">{isPolish ? 'Kwota brutto malejąco' : 'Gross amount high to low'}</option>
                <option value="grossAmount-asc">{isPolish ? 'Kwota brutto rosnąco' : 'Gross amount low to high'}</option>
                <option value="type-asc">{isPolish ? 'Typ od A do Z' : 'Type A to Z'}</option>
                <option value="account-asc">{isPolish ? 'Konto od A do Z' : 'Account A to Z'}</option>
                <option value="createdAt-desc">{isPolish ? 'Ostatnio utworzone' : 'Recently created'}</option>
              </select>
            </label>

            {hasActiveJournalFilters && (
              <button type="button" className={btnGhost} onClick={resetJournalFilters}>
                {isPolish ? 'Resetuj filtry' : 'Reset filters'}
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
                <span>{isPolish ? 'Wiersze' : 'Rows'}</span>
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
                {isPolish ? 'Poprzednia' : 'Previous'}
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
                {isPolish ? 'Następna' : 'Next'}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeWorkspace === 'journal' && (
        <div className="space-y-3">
          {transactionsQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Ładowanie transakcji...' : 'Loading transactions...'}</p>}
          {transactionsQuery.isError && (
            <p className="text-sm text-red-400">{transactionsQuery.error.message}</p>
          )}
          {transactionsQuery.data?.length === 0 && (
            <EmptyState
              title={isPolish ? 'Brak jeszcze transakcji' : 'No transactions yet'}
              description={
                isPolish
                  ? 'Zacznij od pierwszego zdarzenia w ledgerze. Formularz otworzysz dopiero wtedy, gdy będziesz gotowy.'
                  : 'Start with the first ledger event. Open the composer only when you are ready.'
              }
              action={{
                label: isPolish ? 'Dodaj transakcję' : 'Add transaction',
                onClick: openComposerForCreate,
              }}
            />
          )}
          {transactionsQuery.data?.length !== 0 && pagedRows.length === 0 && (
            <EmptyState
              title={isPolish ? 'Brak dopasowań w dzienniku' : 'No journal matches'}
              description={
                isPolish
                  ? 'Żaden wiersz nie pasuje do bieżących filtrów. Wyczyść zawężenia albo poszerz wyszukiwanie.'
                  : 'No rows match the current filters. Clear the constraints or broaden the search.'
              }
              action={{
                label: isPolish ? 'Resetuj filtry' : 'Reset filters',
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
                  {isPolish ? 'Utworzono' : 'Created'} {formatDate(transaction.createdAt)}
                </p>

                <div className="flex flex-wrap gap-2 mt-1">
                  {transaction.quantity ? (
                    <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                      {isPolish ? 'ilość' : 'qty'} {formatNumber(transaction.quantity, { maximumFractionDigits: 6 })}
                    </span>
                  ) : null}
                  {transaction.unitPrice ? (
                    <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                      {isPolish ? 'cena' : 'px'} {formatCurrency(transaction.unitPrice, transaction.currency)}
                    </span>
                  ) : null}
                  {Number(transaction.feeAmount) !== 0 ? (
                    <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                      {isPolish ? 'prow.' : 'fee'} {formatCurrency(transaction.feeAmount, transaction.currency)}
                    </span>
                  ) : null}
                  {Number(transaction.taxAmount) !== 0 ? (
                    <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                      {isPolish ? 'pod.' : 'tax'} {formatCurrency(transaction.taxAmount, transaction.currency)}
                    </span>
                  ) : null}
                  {transaction.fxRateToPln ? (
                    <span className={`${badge} bg-zinc-800 text-zinc-400`}>
                      fx {formatNumber(transaction.fxRateToPln, { maximumFractionDigits: 6 })}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`${badge} bg-zinc-800 text-zinc-400`}>{transaction.id.slice(0, 8)}</span>
                <button type="button" className={btnSecondary} onClick={() => startEditing(transaction)}>
                  {isPolish ? 'Edytuj' : 'Edit'}
                </button>
                {pendingDeleteTransactionId !== transaction.id && (
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => requestDeleteTransaction(transaction.id)}
                    disabled={deleteTransactionMutation.isPending}
                  >
                    {isPolish ? 'Usuń' : 'Delete'}
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
                  description={
                    isPolish
                      ? 'To usuwa kanoniczne zdarzenie z dziennika i od razu zmienia wycenę, historię, alokację i zwroty.'
                      : 'This removes the canonical event from the journal and immediately changes valuation, history, allocation and returns.'
                  }
                  confirmLabel={isPolish ? 'Usuń transakcję' : 'Delete transaction'}
                  confirmPendingLabel={isPolish ? 'Usuwanie...' : 'Deleting...'}
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
      )}

      {activeWorkspace === 'import' && (
        <section className={card}>
          <ImportAuditPanel
            title={isPolish ? 'Ostatnie importy' : 'Recent imports'}
            description={
              isPolish
                ? 'Używaj tego jako szybkiego śladu audytowego po operacjach batch.'
                : 'Use this as a quick audit trail after batch operations.'
            }
            limit={8}
          />
        </section>
      )}
    </section>
  )
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

function createInitialImportProfileForm(): ImportProfileFormState {
  const isPolish = getActiveUiLanguage() === 'pl'
  return {
    name: isPolish ? 'Kanoniczny CSV' : 'Canonical CSV',
    description: isPolish
      ? 'Domyślny profil dla kanonicznego formatu CSV transakcji.'
      : 'Default profile for the canonical transaction CSV format.',
    delimiter: 'COMMA',
    dateFormat: 'ISO_LOCAL_DATE',
    decimalSeparator: 'DOT',
    skipDuplicatesByDefault: true,
    headerMappings: {
      account: 'account',
      type: 'type',
      tradeDate: 'tradeDate',
      settlementDate: 'settlementDate',
      instrument: 'instrument',
      quantity: 'quantity',
      unitPrice: 'unitPrice',
      grossAmount: 'grossAmount',
      feeAmount: 'feeAmount',
      taxAmount: 'taxAmount',
      currency: 'currency',
      fxRateToPln: 'fxRateToPln',
      notes: 'notes',
    },
    defaults: {
      accountId: '',
      currency: '',
    },
  }
}

function ImportPreviewPanel({
  preview,
  skipDuplicates,
  statusFilter,
  onStatusFilterChange,
  rows,
}: {
  preview: ImportTransactionsPreviewResult
  skipDuplicates: boolean
  statusFilter: ImportPreviewStatusFilter
  onStatusFilterChange: (status: ImportPreviewStatusFilter) => void
  rows: ImportTransactionsPreviewResult['rows']
}) {
  const { isPolish } = useI18n()
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 mb-3 lg:grid-cols-5">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Wszystkie wiersze' : 'Total rows'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.totalRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Do importu' : 'Importable'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.importableRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Istniejące duplikaty' : 'Existing duplicates'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.duplicateExistingCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Duplikaty w paczce' : 'Batch duplicates'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.duplicateBatchCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Błędne' : 'Invalid'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{preview.invalidRowCount}</strong>
        </article>
      </div>

      <p className="text-sm text-zinc-500 mb-4">
        {buildImportPreviewSummary(preview, skipDuplicates)}
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="group" aria-label={isPolish ? 'Wiersze podglądu importu' : 'Import preview rows'}>
          {(
            [
              ['ALL', isPolish ? `Wszystkie (${preview.totalRowCount})` : `All (${preview.totalRowCount})`],
              ['IMPORTABLE', isPolish ? `Do importu (${preview.importableRowCount})` : `Importable (${preview.importableRowCount})`],
              ['DUPLICATE_EXISTING', isPolish ? `Istniejące (${preview.duplicateExistingCount})` : `Existing (${preview.duplicateExistingCount})`],
              ['DUPLICATE_BATCH', isPolish ? `Paczka (${preview.duplicateBatchCount})` : `Batch (${preview.duplicateBatchCount})`],
              ['INVALID', isPolish ? `Błędne (${preview.invalidRowCount})` : `Invalid (${preview.invalidRowCount})`],
            ] as const
          ).map(([status, statusLabel]) => (
            <button
              key={status}
              type="button"
              aria-pressed={status === statusFilter}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${status === statusFilter ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}
              onClick={() => onStatusFilterChange(status)}
            >
              {statusLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <article className="flex items-center justify-between rounded-lg border border-zinc-800/50 px-4 py-3" key={`${row.rowNumber}-${row.status}`}>
            <div>
              <strong className="text-sm font-medium text-zinc-100">{isPolish ? 'Wiersz' : 'Row'} {row.rowNumber}</strong>
              <p className="text-sm text-zinc-500">{row.message}</p>
            </div>
            <span className={`${badge} ${importPreviewBadgeVariant(row.status)}`}>
              {labelImportRowStatus(row.status)}
            </span>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-zinc-500">
            {isPolish
              ? 'Żaden wiersz podglądu nie pasuje do wybranego statusu.'
              : 'No preview rows match the selected status.'}
          </p>
        )}
      </div>
    </div>
  )
}

function importProfileToForm(profile: TransactionImportProfile): ImportProfileFormState {
  return {
    name: profile.name,
    description: profile.description,
    delimiter: profile.delimiter,
    dateFormat: profile.dateFormat,
    decimalSeparator: profile.decimalSeparator,
    skipDuplicatesByDefault: profile.skipDuplicatesByDefault,
    headerMappings: {
      account: profile.headerMappings.account ?? '',
      type: profile.headerMappings.type ?? '',
      tradeDate: profile.headerMappings.tradeDate ?? '',
      settlementDate: profile.headerMappings.settlementDate ?? '',
      instrument: profile.headerMappings.instrument ?? '',
      quantity: profile.headerMappings.quantity ?? '',
      unitPrice: profile.headerMappings.unitPrice ?? '',
      grossAmount: profile.headerMappings.grossAmount ?? '',
      feeAmount: profile.headerMappings.feeAmount ?? '',
      taxAmount: profile.headerMappings.taxAmount ?? '',
      currency: profile.headerMappings.currency ?? '',
      fxRateToPln: profile.headerMappings.fxRateToPln ?? '',
      notes: profile.headerMappings.notes ?? '',
    },
    defaults: {
      accountId: profile.defaults.accountId ?? '',
      currency: profile.defaults.currency ?? '',
    },
  }
}

function buildImportProfilePayload(form: ImportProfileFormState): SaveTransactionImportProfilePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    delimiter: form.delimiter,
    dateFormat: form.dateFormat,
    decimalSeparator: form.decimalSeparator,
    skipDuplicatesByDefault: form.skipDuplicatesByDefault,
    headerMappings: {
      account: normalizeOptionalValue(form.headerMappings.account),
      type: normalizeOptionalValue(form.headerMappings.type),
      tradeDate: normalizeOptionalValue(form.headerMappings.tradeDate),
      settlementDate: normalizeOptionalValue(form.headerMappings.settlementDate),
      instrument: normalizeOptionalValue(form.headerMappings.instrument),
      quantity: normalizeOptionalValue(form.headerMappings.quantity),
      unitPrice: normalizeOptionalValue(form.headerMappings.unitPrice),
      grossAmount: normalizeOptionalValue(form.headerMappings.grossAmount),
      feeAmount: normalizeOptionalValue(form.headerMappings.feeAmount),
      taxAmount: normalizeOptionalValue(form.headerMappings.taxAmount),
      currency: normalizeOptionalValue(form.headerMappings.currency),
      fxRateToPln: normalizeOptionalValue(form.headerMappings.fxRateToPln),
      notes: normalizeOptionalValue(form.headerMappings.notes),
    },
    defaults: {
      accountId: normalizeOptionalValue(form.defaults.accountId),
      currency: normalizeOptionalValue(form.defaults.currency)?.toUpperCase() ?? null,
    },
  }
}

function parseStructuredImportPayload(raw: string, skipDuplicates: boolean): ImportTransactionsPayload {
  const isPolish = getActiveUiLanguage() === 'pl'
  const trimmed = raw.trim()
  if (trimmed === '') {
    throw new Error(
      isPolish
        ? 'Najpierw wklej tablicę JSON z wierszami transakcji albo pełny payload importu.'
        : 'Paste a JSON array of transaction rows or a full import payload first.',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(
      isPolish
        ? 'Strukturalny import musi zawierać poprawny JSON.'
        : 'Structured import must contain valid JSON.',
    )
  }

  if (Array.isArray(parsed)) {
    return {
      skipDuplicates,
      rows: parsed as ImportTransactionsPayload['rows'],
    }
  }

  if (typeof parsed === 'object' && parsed !== null && 'rows' in parsed) {
    const rows = (parsed as { rows?: unknown }).rows
    if (!Array.isArray(rows)) {
      throw new Error(
        isPolish
          ? 'Payload strukturalnego importu musi udostępniać tablicę "rows".'
          : 'Structured import payload must expose a "rows" array.',
      )
    }

    return {
      skipDuplicates,
      rows: rows as ImportTransactionsPayload['rows'],
    }
  }

  throw new Error(
    isPolish
      ? 'Strukturalny import oczekuje tablicy JSON z wierszami albo obiektu z tablicą "rows".'
      : 'Structured import expects either a JSON array of rows or an object with a "rows" array.',
  )
}

function normalizeOptionalValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function serializeImportProfilePayload(payload: SaveTransactionImportProfilePayload) {
  return JSON.stringify(payload)
}

function buildImportProfileTemplate(form: ImportProfileFormState): string {
  const isPolish = getActiveUiLanguage() === 'pl'
  const delimiter = delimiterCharacter(form.delimiter)
  const mappedFields = getImportMappingFields(isPolish).filter((field) => form.headerMappings[field.key].trim() !== '')
  if (mappedFields.length === 0) {
    return isPolish
      ? 'Zmapuj przynajmniej jedną kolumnę CSV, aby wygenerować przykład.'
      : 'Map at least one CSV column to generate a sample.'
  }

  const headers = mappedFields.map((field) => form.headerMappings[field.key].trim())
  const row = mappedFields.map((field) => escapeCsvCell(delimiter, exampleValueForField(field.key, form)))

  return `${headers.map((header) => escapeCsvCell(delimiter, header)).join(delimiter)}\n${row.join(delimiter)}`
}

function exampleValueForField(field: ImportMappingField, form: ImportProfileFormState) {
  switch (field) {
    case 'account':
      return 'Primary'
    case 'type':
      return 'BUY'
    case 'tradeDate':
      return formatExampleDate(form.dateFormat)
    case 'settlementDate':
      return formatExampleDate(form.dateFormat)
    case 'instrument':
      return 'VWRA.L'
    case 'quantity':
      return formatExampleDecimal('2.5', form.decimalSeparator)
    case 'unitPrice':
      return formatExampleDecimal('123.45', form.decimalSeparator)
    case 'grossAmount':
      return formatExampleDecimal('308.63', form.decimalSeparator)
    case 'feeAmount':
      return formatExampleDecimal('1.20', form.decimalSeparator)
    case 'taxAmount':
      return formatExampleDecimal('0', form.decimalSeparator)
    case 'currency':
      return form.defaults.currency.trim() || 'USD'
    case 'fxRateToPln':
      return formatExampleDecimal('4.0123', form.decimalSeparator)
    case 'notes':
      return getActiveUiLanguage() === 'pl' ? 'Pierwsza partia' : 'Starter lot'
    default:
      return ''
  }
}

function formatExampleDate(format: string) {
  switch (format) {
    case 'DMY_DOTS':
      return '14.03.2026'
    case 'DMY_SLASH':
      return '14/03/2026'
    case 'MDY_SLASH':
      return '03/14/2026'
    case 'ISO_LOCAL_DATE':
    default:
      return '2026-03-14'
  }
}

function formatExampleDecimal(value: string, decimalSeparator: string) {
  return decimalSeparator === 'COMMA' ? value.replace('.', ',') : value
}

function delimiterCharacter(delimiter: string) {
  switch (delimiter) {
    case 'SEMICOLON':
      return ';'
    case 'TAB':
      return '\t'
    case 'COMMA':
    default:
      return ','
  }
}

function escapeCsvCell(delimiter: string, value: string) {
  if (value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function buildImportResultMessage(createdCount: number, skippedDuplicateCount: number) {
  const isPolish = getActiveUiLanguage() === 'pl'
  if (skippedDuplicateCount === 0) {
    return isPolish
      ? `Zaimportowano ${createdCount} transakcji.`
      : `Imported ${createdCount} transactions.`
  }

  return isPolish
    ? `Zaimportowano ${createdCount} transakcji i pominięto ${skippedDuplicateCount} duplikatów.`
    : `Imported ${createdCount} transactions and skipped ${skippedDuplicateCount} duplicates.`
}

function buildImportPreviewSummary(
  preview: ImportTransactionsPreviewResult,
  skipDuplicates: boolean,
) {
  const isPolish = getActiveUiLanguage() === 'pl'
  if (preview.invalidRowCount > 0) {
    return skipDuplicates
      ? isPolish
        ? `${preview.invalidRowCount} błędnych wierszy nadal blokuje import. Duplikaty można pominąć automatycznie, ale błędne wiersze trzeba najpierw poprawić.`
        : `${preview.invalidRowCount} invalid rows still block the import. Duplicate rows can be skipped automatically, but invalid rows must be fixed first.`
      : isPolish
        ? `${preview.invalidRowCount} błędnych wierszy i ${preview.duplicateRowCount} duplikatów blokuje obecnie import.`
        : `${preview.invalidRowCount} invalid rows and ${preview.duplicateRowCount} duplicate rows currently block the import.`
  }

  if (preview.duplicateRowCount > 0) {
    return skipDuplicates
      ? isPolish
        ? `${preview.duplicateRowCount} duplikatów zostanie pominiętych, jeśli będziesz kontynuować.`
        : `${preview.duplicateRowCount} duplicate rows will be skipped if you continue.`
      : isPolish
        ? `${preview.duplicateRowCount} duplikatów blokuje obecnie import. Włącz pomijanie duplikatów albo popraw paczkę.`
        : `${preview.duplicateRowCount} duplicate rows currently block the import. Enable duplicate skipping or adjust the batch.`
  }

  return isPolish
    ? 'Wszystkie wiersze nadają się do importu. Możesz bezpiecznie zatwierdzić tę paczkę.'
    : 'All rows are importable. You can safely commit this batch.'
}

function getImportMappingFields(isPolish: boolean) {
  return importMappingFields.map((field) => ({
    ...field,
    label: translateImportMappingLabel(field.key, isPolish),
  }))
}

function translateImportMappingLabel(field: ImportMappingField, isPolish: boolean) {
  if (!isPolish) {
    return importMappingFields.find((candidate) => candidate.key === field)?.label ?? field
  }

  switch (field) {
    case 'account':
      return 'Kolumna konta'
    case 'type':
      return 'Kolumna typu'
    case 'tradeDate':
      return 'Kolumna daty transakcji'
    case 'settlementDate':
      return 'Kolumna daty rozliczenia'
    case 'instrument':
      return 'Kolumna instrumentu'
    case 'quantity':
      return 'Kolumna liczby sztuk'
    case 'unitPrice':
      return 'Kolumna ceny jednostkowej'
    case 'grossAmount':
      return 'Kolumna kwoty brutto'
    case 'feeAmount':
      return 'Kolumna prowizji'
    case 'taxAmount':
      return 'Kolumna podatku'
    case 'currency':
      return 'Kolumna waluty'
    case 'fxRateToPln':
      return 'Kolumna kursu FX do PLN'
    case 'notes':
      return 'Kolumna notatek'
    default:
      return field
  }
}

function importPreviewBadgeVariant(status: string) {
  switch (status) {
    case 'IMPORTABLE':
      return 'bg-emerald-500/15 text-emerald-400'
    case 'DUPLICATE_EXISTING':
    case 'DUPLICATE_BATCH':
      return 'bg-amber-500/15 text-amber-400'
    case 'INVALID':
      return 'bg-red-500/15 text-red-400'
    default:
      return 'bg-zinc-800 text-zinc-400'
  }
}

function compareJournalRows(left: JournalRow, right: JournalRow, sort: string) {
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

function compareAccountsByDisplayOrder(
  left: { displayOrder?: number; createdAt: string; name: string },
  right: { displayOrder?: number; createdAt: string; name: string },
) {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt)
  }

  return left.name.localeCompare(right.name)
}

function compareInstrumentsByName(
  left: { name: string; symbol?: string | null },
  right: { name: string; symbol?: string | null },
) {
  const nameComparison = left.name.localeCompare(right.name)
  if (nameComparison !== 0) {
    return nameComparison
  }

  return (left.symbol ?? '').localeCompare(right.symbol ?? '')
}

function normalizeDecimalInput(value: string): string {
  return value.trim().replace(',', '.')
}

function normalizeDecimalForPayload(value: string): string {
  return normalizeDecimalInput(value)
}

function normalizeOptionalDecimalForPayload(value: string): string | null {
  const normalized = normalizeDecimalInput(value)
  return normalized === '' ? null : normalized
}

function multiplyDecimalInputs(left: string, right: string, decimalSeparator: '.' | ','): string {
  const leftParts = parseDecimalParts(normalizeDecimalInput(left))
  const rightParts = parseDecimalParts(normalizeDecimalInput(right))

  if (leftParts == null || rightParts == null) {
    return ''
  }

  const unscaled = leftParts.unscaled * rightParts.unscaled
  const scale = leftParts.scale + rightParts.scale
  return formatDecimalInput(unscaled, scale, decimalSeparator, 2)
}

function parseDecimalParts(value: string): { unscaled: bigint; scale: number } | null {
  if (value === '' || !/^[+-]?\d*(?:\.\d*)?$/.test(value)) {
    return null
  }

  const negative = value.startsWith('-')
  const unsignedValue = negative || value.startsWith('+') ? value.slice(1) : value
  const [integerPart = '', fractionalPart = ''] = unsignedValue.split('.')
  const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '')

  if (digits === '') {
    return null
  }

  const magnitude = BigInt(digits)
  return {
    unscaled: negative ? -magnitude : magnitude,
    scale: fractionalPart.length,
  }
}

function formatDecimalInput(
  unscaled: bigint,
  scale: number,
  decimalSeparator: '.' | ',',
  minimumFractionDigits: number,
): string {
  const negative = unscaled < 0n
  const magnitude = negative ? -unscaled : unscaled
  const digits = magnitude.toString()
  const paddedDigits = scale > 0 ? digits.padStart(scale + 1, '0') : digits
  const integerPart = scale > 0 ? paddedDigits.slice(0, -scale) : paddedDigits
  let fractionalPart = scale > 0 ? paddedDigits.slice(-scale) : ''

  while (fractionalPart.length > minimumFractionDigits && fractionalPart.endsWith('0')) {
    fractionalPart = fractionalPart.slice(0, -1)
  }

  if (fractionalPart.length < minimumFractionDigits) {
    fractionalPart = fractionalPart.padEnd(minimumFractionDigits, '0')
  }

  const sign = negative ? '-' : ''
  if (fractionalPart.length === 0) {
    return `${sign}${integerPart}`
  }

  return `${sign}${integerPart}${decimalSeparator}${fractionalPart}`
}
