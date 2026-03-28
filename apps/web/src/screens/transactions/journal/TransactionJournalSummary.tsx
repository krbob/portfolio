import { Card, SectionHeader } from '../../../components/ui'
import { activeNotApplicableLabel } from '../../../lib/availability'
import { formatDate } from '../../../lib/format'
import { formatMessage, t } from '../../../lib/messages'
import { btnGhost, btnPrimary, btnSecondary } from '../../../lib/styles'

interface TransactionJournalSummaryProps {
  composerOpen: boolean
  hasActiveJournalFilters: boolean
  sortedRowCount: number
  journalRowCount: number
  accountsInFilteredJournal: number
  pagedRowCount: number
  instrumentsInFilteredJournal: number
  latestTradeDateInFilteredJournal: string | null
  currentPage: number
  totalPages: number
  onToggleComposer: () => void
  onResetJournalFilters: () => void
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

export function TransactionJournalSummary({
  composerOpen,
  hasActiveJournalFilters,
  sortedRowCount,
  journalRowCount,
  accountsInFilteredJournal,
  pagedRowCount,
  instrumentsInFilteredJournal,
  latestTradeDateInFilteredJournal,
  currentPage,
  totalPages,
  onToggleComposer,
  onResetJournalFilters,
}: TransactionJournalSummaryProps) {
  return (
    <Card as="section" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          eyebrow={t('journal.eyebrow')}
          title={t('journal.title')}
          description={t('journal.description')}
          className="mb-0"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={composerOpen ? btnSecondary : btnPrimary} onClick={onToggleComposer}>
            {composerOpen ? t('journal.closeEditor') : t('journal.newTransaction')}
          </button>
          {hasActiveJournalFilters && (
            <button type="button" className={btnGhost} onClick={onResetJournalFilters}>
              {t('journal.clearFilters')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <JournalSummaryTile
          label={t('journal.rowsInView')}
          value={sortedRowCount.toString()}
          hint={formatMessage(t('journal.totalHint'), { count: journalRowCount })}
        />
        <JournalSummaryTile
          label={t('journal.accountsInView')}
          value={accountsInFilteredJournal.toString()}
          hint={formatMessage(t('journal.pagedHint'), { count: pagedRowCount })}
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
              : activeNotApplicableLabel()
          }
          hint={formatMessage(t('journal.pageLabel'), { current: currentPage, total: totalPages })}
        />
      </div>
    </Card>
  )
}
