import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, SectionHeader } from './ui'
import { usePortfolioAuditEvents, usePortfolioHoldings } from '../hooks/use-read-model'
import { useI18n } from '../lib/i18n'
import { labelAuditOutcome } from '../lib/labels'
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
import {
  NEW_IMPORT_PROFILE_ID,
  type TransactionsWorkspace,
} from '../screens/transactions/transactions-helpers'
import { TransactionJournal } from '../screens/transactions/TransactionJournal'
import { TransactionImport } from '../screens/transactions/TransactionImport'
import { TransactionImportProfiles } from '../screens/transactions/TransactionImportProfiles'

export function TransactionsSection() {
  const { isPolish } = useI18n()
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const transactionImportProfilesQuery = useTransactionImportProfiles()
  const holdingsQuery = usePortfolioHoldings()
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

  const [selectedImportProfileId, setSelectedImportProfileId] = useState<string | null>(null)
  const [pendingSavedImportProfile, setPendingSavedImportProfile] = useState<import('../api/write-model').TransactionImportProfile | null>(null)
  const [importProfileDirty, setImportProfileDirty] = useState(false)
  const [importProfileTemplate, setImportProfileTemplate] = useState('')
  const [activeWorkspace, setActiveWorkspace] = useState<TransactionsWorkspace>('journal')

  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []
  const importProfiles = transactionImportProfilesQuery.data ?? []
  const transactions = transactionsQuery.data ?? []

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

  const importEvents = importEventsQuery.data ?? []
  const latestImportEvent = importEvents[0] ?? null

  const journalRowCount = transactions.length
  const sortedRowCount = transactions.length
  const importProfileCount = importProfiles.length

  useEffect(() => {
    if (selectedImportProfileId === null) {
      setSelectedImportProfileId(importProfiles[0]?.id ?? NEW_IMPORT_PROFILE_ID)
    }
  }, [importProfiles, selectedImportProfileId])

  const handleImportProfileDirtyChange = useCallback((dirty: boolean) => {
    setImportProfileDirty(dirty)
  }, [])

  const handleImportProfileTemplateChange = useCallback((template: string) => {
    setImportProfileTemplate(template)
  }, [])

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
            ? 'Nie udało się załadować obszaru transakcji. Spróbuj ponownie albo sprawdź stan systemu w Ustawieniach.'
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
        eyebrow={isPolish ? 'Model zapisu' : 'Write model'}
        title={isPolish ? 'Transakcje' : 'Transactions'}
        description={
          isPolish
            ? 'Prowadź jeden rejestr transakcji, ale pracuj osobno na dzienniku, imporcie i profilach.'
            : 'Keep the canonical event stream in one place, but work through journal, import and profile flows separately.'
        }
        className="mb-2"
      />

      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Transakcje' : 'Transactions'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{journalRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Wiersze dziennika w widoku' : 'Journal rows in view'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{sortedRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{isPolish ? 'Zapisane profile' : 'Saved profiles'}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{importProfileCount}</strong>
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
        <TransactionJournal
          accounts={accountOptions}
          instruments={instrumentOptions}
          transactions={transactions}
          holdingsQuery={holdingsQuery}
          createTransactionMutation={createTransactionMutation}
          updateTransactionMutation={updateTransactionMutation}
          deleteTransactionMutation={deleteTransactionMutation}
        />
      )}

      {activeWorkspace === 'profiles' && (
        <TransactionImportProfiles
          accounts={accountOptions}
          importProfiles={importProfiles}
          selectedImportProfileId={selectedImportProfileId}
          setSelectedImportProfileId={setSelectedImportProfileId}
          selectedImportProfile={selectedImportProfile}
          selectedImportProfileSyncKey={selectedImportProfileSyncKey}
          pendingSavedImportProfile={pendingSavedImportProfile}
          setPendingSavedImportProfile={setPendingSavedImportProfile}
          transactionImportProfilesQuery={transactionImportProfilesQuery}
          createImportProfileMutation={createImportProfileMutation}
          updateImportProfileMutation={updateImportProfileMutation}
          deleteImportProfileMutation={deleteImportProfileMutation}
          onDirtyChange={handleImportProfileDirtyChange}
          onTemplateChange={handleImportProfileTemplateChange}
        />
      )}

      {activeWorkspace === 'import' && (
        <TransactionImport
          selectedImportProfile={selectedImportProfile}
          importProfileDirty={importProfileDirty}
          importProfileBlockingReason={importProfileBlockingReason}
          importProfileTemplate={importProfileTemplate}
          previewTransactionsCsvImportMutation={previewTransactionsCsvImportMutation}
          importTransactionsCsvMutation={importTransactionsCsvMutation}
          previewTransactionsImportMutation={previewTransactionsImportMutation}
          importTransactionsMutation={importTransactionsMutation}
        />
      )}
    </section>
  )
}
