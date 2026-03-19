import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DangerConfirmInline } from './DangerConfirmInline'
import { ImportAuditPanel } from './ImportAuditPanel'
import { SectionCard } from './SectionCard'
import { usePortfolioAuditEvents } from '../hooks/use-read-model'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import {
  useAccounts,
  useCreateTransaction,
  useCreateTransactionImportProfile,
  useDeleteTransaction,
  useDeleteTransactionImportProfile,
  useImportTransactionsCsv,
  useInstruments,
  usePreviewTransactionsCsvImport,
  useTransactionImportProfiles,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransactionImportProfile,
} from '../hooks/use-write-model'
import type {
  ImportTransactionsPreviewResult,
  SaveTransactionImportProfilePayload,
  Transaction,
  TransactionImportProfile,
} from '../api/write-model'

const today = new Date().toISOString().slice(0, 10)
const transactionTypes = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'FEE', 'TAX', 'INTEREST', 'CORRECTION'] as const
const NEW_IMPORT_PROFILE_ID = '__new_import_profile__'

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
  const [form, setForm] = useState(initialForm)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [selectedImportProfileId, setSelectedImportProfileId] = useState<string | null>(null)
  const [pendingSavedImportProfile, setPendingSavedImportProfile] = useState<TransactionImportProfile | null>(null)
  const [importProfileForm, setImportProfileForm] = useState<ImportProfileFormState>(createInitialImportProfileForm)
  const [importCsv, setImportCsv] = useState('')
  const [importSkipDuplicates, setImportSkipDuplicates] = useState(true)
  const [importSourceFileName, setImportSourceFileName] = useState('')
  const [importSourceLabel, setImportSourceLabel] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ImportTransactionsPreviewResult | null>(null)
  const [importPreviewStatusFilter, setImportPreviewStatusFilter] =
    useState<ImportPreviewStatusFilter>('ALL')
  const [importProfileFeedback, setImportProfileFeedback] = useState<string | null>(null)
  const [pendingDeleteImportProfileId, setPendingDeleteImportProfileId] = useState<string | null>(null)
  const [pendingDeleteTransactionId, setPendingDeleteTransactionId] = useState<string | null>(null)
  const [journalFilters, setJournalFilters] = useState(initialJournalFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeWorkspace, setActiveWorkspace] = useState<TransactionsWorkspace>('journal')

  const requiresInstrument = form.type === 'BUY' || form.type === 'SELL'
  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []
  const importProfiles = transactionImportProfilesQuery.data ?? []

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

  const importProfileBlockingReason =
    selectedImportProfileId == null
      ? 'Loading saved import profiles.'
      : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
        ? 'Save a CSV import profile before previewing or importing.'
        : selectedImportProfile == null
          ? 'Selected CSV import profile is no longer available.'
          : importProfileDirty
            ? 'Save profile changes before previewing or importing.'
            : null

  const importBlockedByPreview = Boolean(
    importPreview &&
      (importPreview.invalidRowCount > 0 || (!importSkipDuplicates && importPreview.duplicateRowCount > 0)),
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
    setActiveWorkspace('journal')
    setPendingDeleteTransactionId(null)
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
            setImportProfileFeedback(`Updated import profile "${profile.name}".`)
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
        setImportProfileFeedback(`Created import profile "${profile.name}".`)
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
        setImportProfileFeedback(`Deleted import profile "${selectedImportProfile.name}".`)
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
      setImportError(importProfileBlockingReason ?? 'Save a CSV import profile before previewing.')
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
      setImportError(importProfileBlockingReason ?? 'Save a CSV import profile before importing.')
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

  return (
    <SectionCard
      eyebrow="Write model"
      title="Transactions"
      description="Keep the canonical event stream in one place, but work through journal, import and profile flows separately."
    >
      <div className="section-body section-body-wide">
        <div className="summary-grid">
          <article className="overview-stat">
            <span>Transactions</span>
            <strong>{journalRows.length}</strong>
          </article>
          <article className="overview-stat">
            <span>Journal rows in view</span>
            <strong>{sortedRows.length}</strong>
          </article>
          <article className="overview-stat">
            <span>Saved profiles</span>
            <strong>{importProfiles.length}</strong>
          </article>
          <article className="overview-stat">
            <span>Latest import event</span>
            <strong>{latestImportEvent ? latestImportEvent.outcome : 'n/a'}</strong>
          </article>
        </div>

        <div className="history-toolbar">
          <div className="history-pill-group" role="tablist" aria-label="Transactions workspace">
            {([
              ['journal', 'Journal'],
              ['import', 'Import'],
              ['profiles', 'Profiles'],
            ] as const).map(([workspace, label]) => (
              <button
                key={workspace}
                type="button"
                className={workspace === activeWorkspace ? 'unit-pill unit-pill-active' : 'unit-pill'}
                onClick={() => setActiveWorkspace(workspace)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeWorkspace === 'journal' && (
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
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
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
        )}

        <div className="entity-list">
          {activeWorkspace === 'profiles' && (
            <section className="import-card">
              <div className="section-header">
                <p className="eyebrow">Import profiles</p>
                <h4>Saved CSV parsing rules</h4>
                <p>
                  Keep one profile per broker or export format. Preview and import will always use the last saved
                  version of the selected profile.
                </p>
              </div>

            <div className="import-profile-toolbar">
              <label className="journal-filter import-profile-select">
                <span>Saved profile</span>
                <select
                  value={selectedImportProfileId ?? ''}
                  onChange={(event) => {
                    setImportProfileFeedback(null)
                    setPendingDeleteImportProfileId(null)
                    setSelectedImportProfileId(event.target.value)
                  }}
                >
                  {selectedImportProfileId === null && <option value="">Loading profiles...</option>}
                  {importProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                  <option value={NEW_IMPORT_PROFILE_ID}>New profile</option>
                </select>
              </label>

              <div className="form-actions">
                <button type="button" className="button-secondary" onClick={handleCreateNewImportProfile}>
                  New profile
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={handleDeleteImportProfile}
                  disabled={selectedImportProfile == null || deleteImportProfileMutation.isPending}
                >
                  {deleteImportProfileMutation.isPending ? 'Deleting...' : 'Delete profile'}
                </button>
              </div>
            </div>

            {selectedImportProfile && pendingDeleteImportProfileId === selectedImportProfile.id && (
              <DangerConfirmInline
                title={`Delete profile "${selectedImportProfile.name}"?`}
                description="This removes the saved parsing rules from the server. Existing imported transactions stay untouched."
                confirmLabel="Delete profile"
                confirmPendingLabel="Deleting..."
                isPending={deleteImportProfileMutation.isPending}
                onCancel={() => setPendingDeleteImportProfileId(null)}
                onConfirm={confirmDeleteImportProfile}
              />
            )}

              <form className="entity-form import-profile-form" onSubmit={handleImportProfileSubmit}>
                <label>
                  <span>Name</span>
                  <input
                    value={importProfileForm.name}
                    onChange={(event) => updateImportProfileField('name', event.target.value)}
                    placeholder="IBKR activity export"
                    required
                  />
                </label>

              <label>
                <span>Description</span>
                <input
                  value={importProfileForm.description}
                  onChange={(event) => updateImportProfileField('description', event.target.value)}
                  placeholder="Semicolon export with European decimals"
                />
              </label>

              <label>
                <span>Delimiter</span>
                <select
                  value={importProfileForm.delimiter}
                  onChange={(event) => updateImportProfileField('delimiter', event.target.value)}
                >
                  <option value="COMMA">Comma</option>
                  <option value="SEMICOLON">Semicolon</option>
                  <option value="TAB">Tab</option>
                </select>
              </label>

              <label>
                <span>Date format</span>
                <select
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
                <span>Decimal separator</span>
                <select
                  value={importProfileForm.decimalSeparator}
                  onChange={(event) => updateImportProfileField('decimalSeparator', event.target.value)}
                >
                  <option value="DOT">Dot</option>
                  <option value="COMMA">Comma</option>
                </select>
              </label>

              <label>
                <span>Default account</span>
                <select
                  value={importProfileForm.defaults.accountId}
                  onChange={(event) => updateImportProfileDefault('accountId', event.target.value)}
                >
                  <option value="">CSV provides account column</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Default currency</span>
                <input
                  value={importProfileForm.defaults.currency}
                  onChange={(event) => updateImportProfileDefault('currency', event.target.value.toUpperCase())}
                  placeholder="USD"
                  maxLength={3}
                />
              </label>

              <label className="import-checkbox-field">
                <input
                  type="checkbox"
                  checked={importProfileForm.skipDuplicatesByDefault}
                  onChange={(event) => updateImportProfileField('skipDuplicatesByDefault', event.target.checked)}
                />
                <div>
                  <span>Skip duplicates by default</span>
                  <p className="muted-copy">Used to prefill the import checkbox for this profile.</p>
                </div>
              </label>

              <div className="form-span-full import-mapping-panel">
                <div className="section-header">
                  <p className="eyebrow">Header mappings</p>
                  <h5>Match CSV columns to canonical transaction fields</h5>
                </div>
                <div className="import-mapping-grid">
                  {importMappingFields.map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <input
                        value={importProfileForm.headerMappings[field.key]}
                        onChange={(event) => updateImportProfileMapping(field.key, event.target.value)}
                        placeholder={field.placeholder}
                      />
                      {field.required && <small className="field-note">Required by the backend parser.</small>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-span-full import-template-preview">
                <div className="section-header">
                  <p className="eyebrow">Template preview</p>
                  <p>Sample header and one example row generated from the current profile form.</p>
                </div>
                <pre>{importProfileTemplate}</pre>
              </div>

              <div className="form-actions form-span-full">
                <button
                  type="submit"
                  disabled={
                    importProfileForm.name.trim() === '' ||
                    createImportProfileMutation.isPending ||
                    updateImportProfileMutation.isPending
                  }
                >
                  {createImportProfileMutation.isPending || updateImportProfileMutation.isPending
                    ? 'Saving...'
                    : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
                      ? 'Create profile'
                      : 'Save profile'}
                </button>
              </div>

              {importProfileFeedback && <p className="muted-copy form-span-full">{importProfileFeedback}</p>}
              {(transactionImportProfilesQuery.error ||
                createImportProfileMutation.error ||
                updateImportProfileMutation.error ||
                deleteImportProfileMutation.error) && (
                <p className="form-error form-span-full">
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
            <form className="import-card" onSubmit={handleImportSubmit}>
              <div className="section-header">
                <p className="eyebrow">Batch import</p>
                <h4>Preview and import broker CSV</h4>
                <p>
                  Paste the raw broker export and let the server parse it with the selected profile. Account names and
                  instruments are resolved on the backend, so the preview matches the final import.
                </p>
              </div>

            <div className="import-card-summary">
              <span className="list-badge">
                {selectedImportProfile ? selectedImportProfile.name : 'No saved profile selected'}
              </span>
              {importProfileBlockingReason && <p className="muted-copy">{importProfileBlockingReason}</p>}
            </div>

              <div className="journal-toolbar">
                <label className="journal-filter journal-filter-wide">
                  <span>Source file</span>
                  <input
                    value={importSourceFileName}
                    onChange={(event) => setImportSourceFileName(event.target.value)}
                    placeholder="ibkr-activity-2026-03.csv"
                  />
                </label>
                <label className="journal-filter journal-filter-wide">
                  <span>Source label</span>
                  <input
                    value={importSourceLabel}
                    onChange={(event) => setImportSourceLabel(event.target.value)}
                    placeholder="IBKR March 2026 export"
                  />
                </label>
              </div>

              <textarea
                className="import-textarea"
                value={importCsv}
                onChange={(event) => setImportCsv(event.target.value)}
                placeholder={importProfileTemplate}
              />

              <label className="import-option">
                <input
                  type="checkbox"
                  checked={importSkipDuplicates}
                  onChange={(event) => setImportSkipDuplicates(event.target.checked)}
                  disabled={selectedImportProfile == null}
                />
                <span>Skip duplicate rows during import</span>
              </label>

              <div className="form-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleImportPreview}
                  disabled={
                    previewTransactionsCsvImportMutation.isPending ||
                    importCsv.trim() === '' ||
                    importProfileBlockingReason !== null
                  }
                >
                  {previewTransactionsCsvImportMutation.isPending ? 'Previewing...' : 'Preview import'}
                </button>
                <button
                  type="submit"
                  disabled={
                    importTransactionsCsvMutation.isPending ||
                    previewTransactionsCsvImportMutation.isPending ||
                    importCsv.trim() === '' ||
                    importBlockedByPreview ||
                    importProfileBlockingReason !== null
                  }
                >
                  {importTransactionsCsvMutation.isPending ? 'Importing...' : 'Import CSV'}
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
                      <span>Existing duplicates</span>
                      <strong>{importPreview.duplicateExistingCount}</strong>
                    </article>
                    <article className="import-preview-card">
                      <span>Batch duplicates</span>
                      <strong>{importPreview.duplicateBatchCount}</strong>
                    </article>
                    <article className="import-preview-card">
                      <span>Invalid</span>
                      <strong>{importPreview.invalidRowCount}</strong>
                    </article>
                  </div>

                  <p className="muted-copy">
                    {buildImportPreviewSummary(importPreview, importSkipDuplicates)}
                  </p>

                  <div className="history-toolbar">
                    <div className="history-pill-group" role="tablist" aria-label="Import preview rows">
                      {(
                        [
                          ['ALL', `All (${importPreview.totalRowCount})`],
                          ['IMPORTABLE', `Importable (${importPreview.importableRowCount})`],
                          ['DUPLICATE_EXISTING', `Existing (${importPreview.duplicateExistingCount})`],
                          ['DUPLICATE_BATCH', `Batch (${importPreview.duplicateBatchCount})`],
                          ['INVALID', `Invalid (${importPreview.invalidRowCount})`],
                        ] as const
                      ).map(([status, label]) => (
                        <button
                          key={status}
                          type="button"
                          className={
                            status === importPreviewStatusFilter
                              ? 'unit-pill unit-pill-active'
                              : 'unit-pill'
                          }
                          onClick={() => setImportPreviewStatusFilter(status)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="import-preview-list">
                    {visibleImportPreviewRows.map((row) => (
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
                    {visibleImportPreviewRows.length === 0 && (
                      <p className="muted-copy">No preview rows match the selected status.</p>
                    )}
                  </div>
                </div>
              )}

              {importFeedback && <p className="muted-copy">{importFeedback}</p>}
              {(importError || previewTransactionsCsvImportMutation.error || importTransactionsCsvMutation.error) && (
                <p className="form-error">
                  {importError ??
                    previewTransactionsCsvImportMutation.error?.message ??
                    importTransactionsCsvMutation.error?.message}
                </p>
              )}
            </form>
          )}

          {activeWorkspace === 'journal' && (
            <section className="journal-card">
              <div className="section-header">
                <p className="eyebrow">Journal</p>
                <h4>Transaction journal</h4>
                <p>Filter and sort the canonical event stream before editing or deleting rows.</p>
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
                  {transactionTypes.map((type) => (
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
          )}

          {activeWorkspace === 'journal' && (
            <>
              {transactionsQuery.isLoading && <p className="muted-copy">Loading transactions...</p>}
              {transactionsQuery.isError && (
                <p className="form-error">{transactionsQuery.error.message}</p>
              )}
              {transactionsQuery.data?.length === 0 && <p className="muted-copy">No transactions yet.</p>}
              {transactionsQuery.data?.length !== 0 && pagedRows.length === 0 && (
                <p className="muted-copy">No journal rows match the current filters.</p>
              )}
              {pagedRows.map(({ transaction, accountName, instrumentName, instrumentSymbol }) => (
                <article className="list-item transaction-list-item" key={transaction.id}>
                  <div className="transaction-row-main">
                    <div className="transaction-row-heading">
                      <div className="transaction-row-title">
                        <span className={`status-badge ${transactionTypeStatusClassName(transaction.type)}`}>
                          {transaction.type}
                        </span>
                        <strong>{accountName}</strong>
                      </div>
                      <strong className="transaction-row-amount">
                        {formatCurrency(transaction.grossAmount, transaction.currency)}
                      </strong>
                    </div>

                    <p>
                      Trade {formatDate(transaction.tradeDate)}
                      {transaction.settlementDate ? ` · settle ${formatDate(transaction.settlementDate)}` : ''}
                      {instrumentName ? ` · ${instrumentName}` : ''}
                      {instrumentSymbol ? ` (${instrumentSymbol})` : ''}
                    </p>

                    {transaction.notes ? <p className="transaction-row-note">{transaction.notes}</p> : null}

                    <p className="transaction-row-meta">
                      Created {formatDate(transaction.createdAt)}
                    </p>

                    <div className="transaction-row-tags">
                      {transaction.quantity ? (
                        <span className="list-badge">
                          qty {formatNumber(transaction.quantity, { maximumFractionDigits: 6 })}
                        </span>
                      ) : null}
                      {transaction.unitPrice ? (
                        <span className="list-badge">
                          px {formatCurrency(transaction.unitPrice, transaction.currency)}
                        </span>
                      ) : null}
                      {Number(transaction.feeAmount) !== 0 ? (
                        <span className="list-badge">
                          fee {formatCurrency(transaction.feeAmount, transaction.currency)}
                        </span>
                      ) : null}
                      {Number(transaction.taxAmount) !== 0 ? (
                        <span className="list-badge">
                          tax {formatCurrency(transaction.taxAmount, transaction.currency)}
                        </span>
                      ) : null}
                      {transaction.fxRateToPln ? (
                        <span className="list-badge">
                          fx {formatNumber(transaction.fxRateToPln, { maximumFractionDigits: 6 })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="list-item-actions">
                    <span className="list-badge">{transaction.id.slice(0, 8)}</span>
                    <button type="button" className="button-secondary" onClick={() => startEditing(transaction)}>
                      Edit
                    </button>
                    {pendingDeleteTransactionId !== transaction.id && (
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => requestDeleteTransaction(transaction.id)}
                        disabled={deleteTransactionMutation.isPending}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {pendingDeleteTransactionId === transaction.id && (
                    <DangerConfirmInline
                      title={`Delete transaction ${transaction.type} on ${transaction.tradeDate}?`}
                      description="This removes the canonical event from the journal and immediately changes valuation, history, allocation and returns."
                      confirmLabel="Delete transaction"
                      confirmPendingLabel="Deleting..."
                      isPending={deleteTransactionMutation.isPending}
                      onCancel={cancelDeleteTransaction}
                      onConfirm={() => confirmDeleteTransaction(transaction.id)}
                    />
                  )}
                </article>
              ))}
              {deleteTransactionMutation.error && (
                <p className="form-error">{deleteTransactionMutation.error.message}</p>
              )}
            </>
          )}

          {activeWorkspace === 'import' && (
            <section className="import-card">
              <ImportAuditPanel
                title="Recent imports"
                description="Use this as a quick audit trail after batch operations."
                limit={8}
              />
            </section>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function createInitialImportProfileForm(): ImportProfileFormState {
  return {
    name: 'Canonical CSV',
    description: 'Default profile for the canonical transaction CSV format.',
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

function normalizeOptionalValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function serializeImportProfilePayload(payload: SaveTransactionImportProfilePayload) {
  return JSON.stringify(payload)
}

function buildImportProfileTemplate(form: ImportProfileFormState): string {
  const delimiter = delimiterCharacter(form.delimiter)
  const mappedFields = importMappingFields.filter((field) => form.headerMappings[field.key].trim() !== '')
  if (mappedFields.length === 0) {
    return 'Map at least one CSV column to generate a sample.'
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
      return 'Starter lot'
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
  if (skippedDuplicateCount === 0) {
    return `Imported ${createdCount} transactions.`
  }

  return `Imported ${createdCount} transactions and skipped ${skippedDuplicateCount} duplicates.`
}

function buildImportPreviewSummary(
  preview: ImportTransactionsPreviewResult,
  skipDuplicates: boolean,
) {
  if (preview.invalidRowCount > 0) {
    return skipDuplicates
      ? `${preview.invalidRowCount} invalid rows still block the import. Duplicate rows can be skipped automatically, but invalid rows must be fixed first.`
      : `${preview.invalidRowCount} invalid rows and ${preview.duplicateRowCount} duplicate rows currently block the import.`
  }

  if (preview.duplicateRowCount > 0) {
    return skipDuplicates
      ? `${preview.duplicateRowCount} duplicate rows will be skipped if you continue.`
      : `${preview.duplicateRowCount} duplicate rows currently block the import. Enable duplicate skipping or adjust the batch.`
  }

  return 'All rows are importable. You can safely commit this batch.'
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

function transactionTypeStatusClassName(type: Transaction['type']) {
  switch (type) {
    case 'DEPOSIT':
    case 'INTEREST':
      return 'status-valued'
    case 'WITHDRAWAL':
    case 'FEE':
    case 'TAX':
      return 'status-unavailable'
    case 'CORRECTION':
      return 'status-warning'
    default:
      return 'status-info'
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
