import type { Dispatch, SetStateAction } from 'react'
import { DangerConfirmInline } from '../../../components/DangerConfirmInline'
import { EmptyState, SectionHeader } from '../../../components/ui'
import { formatCurrency, formatDate, formatNumber } from '../../../lib/format'
import { labelTransactionType } from '../../../lib/labels'
import { formatMessage, t } from '../../../lib/messages'
import {
  badge,
  btnDanger,
  btnGhost,
  btnSecondary,
  card,
  filterInput,
  label as labelClass,
  txBadgeVariants,
} from '../../../lib/styles'
import type { Account, Instrument, Transaction } from '../../../api/write-model'
import type { JournalRow, JournalFilters } from '../transactions-helpers'

interface TransactionJournalReviewProps {
  transactions: Transaction[]
  pagedRows: JournalRow[]
  sortedRows: JournalRow[]
  journalRowsCount: number
  sortedAccountOptions: Account[]
  sortedInstrumentOptions: Instrument[]
  journalFilters: JournalFilters
  currencyOptions: string[]
  currentPage: number
  totalPages: number
  pendingDeleteTransactionId: string | null
  deletePending: boolean
  deleteErrorMessage: string | null
  onUpdateJournalFilter: (name: keyof JournalFilters, value: string) => void
  onResetJournalFilters: () => void
  onSetCurrentPage: Dispatch<SetStateAction<number>>
  onOpenComposerForCreate: () => void
  onStartEditing: (transaction: Transaction) => void
  onRequestDeleteTransaction: (transactionId: string) => void
  onCancelDeleteTransaction: () => void
  onConfirmDeleteTransaction: (transactionId: string) => void
}

export function TransactionJournalReview({
  transactions,
  pagedRows,
  sortedRows,
  journalRowsCount,
  sortedAccountOptions,
  sortedInstrumentOptions,
  journalFilters,
  currencyOptions,
  currentPage,
  totalPages,
  pendingDeleteTransactionId,
  deletePending,
  deleteErrorMessage,
  onUpdateJournalFilter,
  onResetJournalFilters,
  onSetCurrentPage,
  onOpenComposerForCreate,
  onStartEditing,
  onRequestDeleteTransaction,
  onCancelDeleteTransaction,
  onConfirmDeleteTransaction,
}: TransactionJournalReviewProps) {
  const hasActiveJournalFilters =
    journalFilters.search !== '' ||
    journalFilters.accountId !== 'ALL' ||
    journalFilters.instrumentId !== 'ALL' ||
    journalFilters.type !== 'ALL' ||
    journalFilters.currency !== 'ALL' ||
    journalFilters.sort !== 'tradeDate-desc'

  return (
    <>
      <section className={card}>
        <SectionHeader
          eyebrow={t('journal.reviewEyebrow')}
          title={t('journal.reviewTitle')}
          description={t('journal.reviewDescription')}
          className="mb-4"
        />

        <div className="mb-4 flex flex-wrap items-end gap-3 [&>*]:min-w-0">
          <label className="min-w-[200px] flex-1">
            <span className={labelClass}>{t('journal.search')}</span>
            <input
              className={filterInput}
              value={journalFilters.search}
              onChange={(event) => onUpdateJournalFilter('search', event.target.value)}
              placeholder={t('journal.searchPlaceholder')}
            />
          </label>

          <label>
            <span className={labelClass}>{t('journal.filterAccount')}</span>
            <select
              className={filterInput}
              value={journalFilters.accountId}
              onChange={(event) => onUpdateJournalFilter('accountId', event.target.value)}
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
              onChange={(event) => onUpdateJournalFilter('instrumentId', event.target.value)}
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
              onChange={(event) => onUpdateJournalFilter('type', event.target.value)}
            >
              <option value="ALL">{t('journal.allTypes')}</option>
              {['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'TAX', 'DEPOSIT', 'WITHDRAWAL', 'REDEEM'].map((type) => (
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
              onChange={(event) => onUpdateJournalFilter('currency', event.target.value)}
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
              onChange={(event) => onUpdateJournalFilter('sort', event.target.value)}
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
            <button type="button" className={btnGhost} onClick={onResetJournalFilters}>
              {t('journal.resetFilters')}
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          <span>
            {formatMessage(t('journal.showingRows'), { paged: pagedRows.length, sorted: sortedRows.length, total: journalRowsCount })}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>{t('journal.rows')}</span>
              <select
                className={filterInput}
                value={journalFilters.pageSize}
                onChange={(event) => onUpdateJournalFilter('pageSize', event.target.value)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>

            <button
              type="button"
              className={btnSecondary}
              onClick={() => onSetCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
            >
              {t('journal.previous')}
            </button>
            <span>{formatMessage(t('journal.pageLabel'), { current: currentPage, total: totalPages })}</span>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => onSetCurrentPage((page) => Math.min(totalPages, page + 1))}
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
              onClick: onOpenComposerForCreate,
            }}
          />
        )}
        {transactions.length !== 0 && pagedRows.length === 0 && (
          <EmptyState
            title={t('journal.noMatchesTitle')}
            description={t('journal.noMatchesDescription')}
            action={{
              label: t('journal.resetFilters'),
              onClick: onResetJournalFilters,
            }}
          />
        )}
        {pagedRows.map(({ transaction, accountName, instrumentName, instrumentSymbol }) => (
          <article className="space-y-2 rounded-lg border border-zinc-800/50 bg-zinc-900 p-4" key={transaction.id}>
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`${badge} ${txBadgeVariants[transaction.type as keyof typeof txBadgeVariants] ?? ''}`}>
                    {labelTransactionType(transaction.type)}
                  </span>
                  <strong className="text-sm font-medium text-zinc-100">{instrumentName ?? accountName}</strong>
                </div>
                <strong className="text-sm font-medium tabular-nums text-zinc-100">
                  {formatCurrency(transaction.grossAmount, transaction.currency)}
                </strong>
              </div>

              <p className="mt-1 text-sm text-zinc-400">
                {accountName}
                {instrumentSymbol ? ` · ${instrumentSymbol}` : ''}
                {` · ${t('journal.tradePrefix')} ${formatDate(transaction.tradeDate)}`}
                {transaction.settlementDate
                  ? ` · ${t('journal.settlementPrefix')} ${formatDate(transaction.settlementDate)}`
                  : ''}
              </p>

              {transaction.notes ? <p className="text-sm italic text-zinc-500">{transaction.notes}</p> : null}

              <p className="text-xs text-zinc-600">
                {t('journal.created')} {formatDate(transaction.createdAt)}
              </p>

              <div className="mt-1 flex flex-wrap gap-2">
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
              <button type="button" className={btnSecondary} onClick={() => onStartEditing(transaction)}>
                {t('journal.edit')}
              </button>
              {pendingDeleteTransactionId !== transaction.id && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => onRequestDeleteTransaction(transaction.id)}
                  disabled={deletePending}
                >
                  {t('journal.delete')}
                </button>
              )}
            </div>

            {pendingDeleteTransactionId === transaction.id && (
              <DangerConfirmInline
                title={formatMessage(t('journal.deleteConfirmTitle'), { type: labelTransactionType(transaction.type), date: transaction.tradeDate })}
                description={t('journal.deleteDescription')}
                confirmLabel={t('journal.deleteTransaction')}
                confirmPendingLabel={t('journal.deleting')}
                isPending={deletePending}
                onCancel={onCancelDeleteTransaction}
                onConfirm={() => onConfirmDeleteTransaction(transaction.id)}
              />
            )}
          </article>
        ))}

        {deleteErrorMessage && <p className="text-sm text-red-400">{deleteErrorMessage}</p>}
      </div>
    </>
  )
}
