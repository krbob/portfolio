import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, SectionHeader } from './ui'
import { usePortfolioAuditEvents, usePortfolioHoldings } from '../hooks/use-read-model'
import { labelAuditOutcome } from '../lib/labels'
import { t } from '../lib/messages'
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
import type { TransactionRouteState } from '../lib/transaction-composer'

export function TransactionsSection() {
  const location = useLocation()
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
  const [filteredJournalRowCount, setFilteredJournalRowCount] = useState<number | null>(null)

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
      ? t('transactionsOrch.loadingProfiles')
      : selectedImportProfileId === NEW_IMPORT_PROFILE_ID
        ? t('transactionsOrch.saveProfileBeforeAction')
        : selectedImportProfile == null
          ? t('transactionsOrch.profileUnavailable')
          : importProfileDirty
            ? t('transactionsOrch.saveProfileChanges')
            : null

  const importEvents = importEventsQuery.data ?? []
  const latestImportEvent = importEvents[0] ?? null

  const journalRowCount = transactions.length
  const sortedRowCount = filteredJournalRowCount ?? transactions.length
  const importProfileCount = importProfiles.length

  useEffect(() => {
    if (selectedImportProfileId === null) {
      setSelectedImportProfileId(importProfiles[0]?.id ?? NEW_IMPORT_PROFILE_ID)
    }
  }, [importProfiles, selectedImportProfileId])

  useEffect(() => {
    const routeState = (location.state as TransactionRouteState | null) ?? {}
    if (routeState.transactionDraft != null && activeWorkspace !== 'journal') {
      setActiveWorkspace('journal')
    }
  }, [activeWorkspace, location.state])

  useEffect(() => {
    if (activeWorkspace !== 'journal') {
      setFilteredJournalRowCount(null)
    }
  }, [activeWorkspace])

  const handleFilteredRowCountChange = useCallback((count: number) => {
    setFilteredJournalRowCount(count)
  }, [])

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
        title={t('transactionsOrch.loadingTitle')}
        description={t('transactionsOrch.loadingDescription')}
        blocks={4}
      />
    )
  }

  if (!hasWorkspaceData && workspaceError) {
    return (
      <ErrorState
        title={t('transactionsOrch.errorTitle')}
        description={t('transactionsOrch.errorDescription')}
        onRetry={handleRetryWorkspace}
      />
    )
  }

  if (accountOptions.length === 0) {
    return (
      <EmptyState
        title={t('transactionsOrch.noAccountsTitle')}
        description={t('transactionsOrch.noAccountsDescription')}
        action={{ label: t('transactionsOrch.goToAccounts'), to: '/accounts' }}
      />
    )
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow={t('transactionsOrch.eyebrow')}
        title={t('transactionsOrch.title')}
        description={t('transactionsOrch.description')}
        className="mb-2"
      />

      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('transactionsOrch.transactions')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{journalRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('transactionsOrch.journalRowsInView')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{sortedRowCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('transactionsOrch.savedProfiles')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">{importProfileCount}</strong>
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-xs text-zinc-500">{t('transactionsOrch.latestImportEvent')}</span>
          <strong className="mt-1 block text-xl font-bold tabular-nums text-zinc-100">
            {latestImportEvent ? labelAuditOutcome(latestImportEvent.outcome) : t('common.none')}
          </strong>
        </article>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1" role="tablist" aria-label={t('transactionsOrch.workspaceLabel')}>
          {([
            ['journal', t('transactionsOrch.journal')],
            ['import', t('transactionsOrch.import')],
            ['profiles', t('transactionsOrch.profiles')],
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
          onFilteredRowCountChange={handleFilteredRowCountChange}
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
