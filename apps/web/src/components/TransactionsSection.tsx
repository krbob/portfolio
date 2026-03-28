import { useCallback, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, SectionHeader } from './ui'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { t } from '../lib/messages'
import {
  useAccounts,
  useCreateTransaction,
  useDeleteTransaction,
  useInstruments,
  useTransactions,
  useUpdateTransaction,
} from '../hooks/use-write-model'
import { TransactionJournal } from '../screens/transactions/TransactionJournal'

export function TransactionsSection() {
  const accountsQuery = useAccounts()
  const instrumentsQuery = useInstruments()
  const transactionsQuery = useTransactions()
  const holdingsQuery = usePortfolioHoldings()
  const createTransactionMutation = useCreateTransaction()
  const updateTransactionMutation = useUpdateTransaction()
  const deleteTransactionMutation = useDeleteTransaction()

  const [filteredJournalRowCount, setFilteredJournalRowCount] = useState<number | null>(null)

  const accountOptions = accountsQuery.data ?? []
  const instrumentOptions = instrumentsQuery.data ?? []
  const transactions = transactionsQuery.data ?? []

  const hasWorkspaceData =
    accountsQuery.data != null ||
    instrumentsQuery.data != null ||
    transactionsQuery.data != null
  const workspaceError =
    accountsQuery.error ??
    instrumentsQuery.error ??
    transactionsQuery.error

  const journalRowCount = transactions.length
  const sortedRowCount = filteredJournalRowCount ?? transactions.length

  const handleFilteredRowCountChange = useCallback((count: number) => {
    setFilteredJournalRowCount(count)
  }, [])

  function handleRetryWorkspace() {
    void Promise.all([
      accountsQuery.refetch(),
      instrumentsQuery.refetch(),
      transactionsQuery.refetch(),
    ])
  }

  if (
    !hasWorkspaceData &&
    (accountsQuery.isLoading ||
      instrumentsQuery.isLoading ||
      transactionsQuery.isLoading)
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
      </div>

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
    </section>
  )
}
