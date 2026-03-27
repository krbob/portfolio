import { useEffect, useMemo, useState } from 'react'
import type { PortfolioAccountSummary } from '../api/read-model'
import { AccountsSection } from '../components/AccountsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { usePortfolioAccounts, usePortfolioHoldings } from '../hooks/use-read-model'
import { useReorderAccounts } from '../hooks/use-write-model'
import { formatCurrencyBreakdown, formatCurrencyPln, formatPercent, hasMeaningfulCurrencyBreakdown } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAccountType } from '../lib/labels'
import { t } from '../lib/messages'
import {
  calculateGainPct,
  describeHoldingGainRate,
  describePortfolioGain,
  formatPortfolioGainDisplay,
  labelPortfolioValuationState,
  parsePortfolioNumber,
  portfolioValuationStateVariant,
} from '../lib/portfolio-presentation'
import { AccountDetailsCard, AccountSummaryTile, DragHandleIcon } from './accounts/AccountsScreenSections'
import { badge, td, tdRight, th, thRight, tr } from '../lib/styles'

export function AccountsScreen() {
  const { isPolish } = useI18n()
  const accountsQuery = usePortfolioAccounts()
  const holdingsQuery = usePortfolioHoldings()
  const reorderAccountsMutation = useReorderAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data])
  const [orderedAccounts, setOrderedAccounts] = useState(accounts)
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null)
  const [dropTargetAccountId, setDropTargetAccountId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const totalValuePln = accounts.reduce((sum, account) => sum + parsePortfolioNumber(account.totalCurrentValuePln), 0)
  const totalCashPln = accounts.reduce((sum, account) => sum + parsePortfolioNumber(account.cashBalancePln), 0)
  const totalGainPln = accounts.reduce((sum, account) => sum + parsePortfolioNumber(account.totalUnrealizedGainPln), 0)
  const degradedCount = accounts.filter((account) => account.valuationState !== 'MARK_TO_MARKET').length
  const totalHoldings = accounts.reduce((sum, account) => sum + account.activeHoldingCount, 0)
  const totalValuedHoldings = accounts.reduce((sum, account) => sum + account.valuedHoldingCount, 0)
  const selectedAccount = orderedAccounts.find((account) => account.accountId === selectedAccountId) ?? orderedAccounts[0] ?? null
  const selectedAccountHoldings = useMemo(
    () => holdings
      .filter((holding) => holding.accountId === selectedAccount?.accountId)
      .sort((left, right) => parsePortfolioNumber(right.currentValuePln ?? right.bookValuePln) - parsePortfolioNumber(left.currentValuePln ?? left.bookValuePln)),
    [holdings, selectedAccount?.accountId],
  )

  useEffect(() => {
    setOrderedAccounts(accounts)
  }, [accounts])

  useEffect(() => {
    if (orderedAccounts.length === 0) {
      setSelectedAccountId(null)
      return
    }

    if (!selectedAccountId || !orderedAccounts.some((account) => account.accountId === selectedAccountId)) {
      setSelectedAccountId(orderedAccounts[0]?.accountId ?? null)
    }
  }, [orderedAccounts, selectedAccountId])

  if (accountsQuery.isLoading || holdingsQuery.isLoading) {
    return (
      <>
        <PageHeader title={t('accountsScreen.title')} />
        <LoadingState
          title={t('accountsScreen.loadingTitle')}
          description={t('accountsScreen.loadingDescription')}
          blocks={4}
        />
      </>
    )
  }

  if (accountsQuery.isError || holdingsQuery.isError) {
    return (
      <>
        <PageHeader title={t('accountsScreen.title')} />
        <ErrorState
          title={t('accountsScreen.errorTitle')}
          description={t('accountsScreen.errorDescription')}
          onRetry={() => void Promise.all([accountsQuery.refetch(), holdingsQuery.refetch()])}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('accountsScreen.title')}>
        <Badge variant="default">
          {accounts.length} {isPolish ? (accounts.length === 1 ? 'konto' : (accounts.length % 10 >= 2 && accounts.length % 10 <= 4 && (accounts.length % 100 < 12 || accounts.length % 100 > 14)) ? 'konta' : 'kont') : 'accounts'}
        </Badge>
        {accounts.length > 0 && (
          <span className="text-sm tabular-nums text-zinc-400">{formatCurrencyPln(totalValuePln)}</span>
        )}
      </PageHeader>

      {accounts.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AccountSummaryTile
            label={t('accountsScreen.accountValue')}
            value={formatCurrencyPln(totalValuePln)}
            detail={isPolish ? `${totalHoldings} pozycji aktywnych` : `${totalHoldings} active holdings`}
          />
          <AccountSummaryTile
            label={t('accountsScreen.cashOnAccounts')}
            value={formatCurrencyPln(totalCashPln)}
            detail={totalValuePln > 0 ? `${formatPercent((totalCashPln / totalValuePln) * 100)} ${t('accountsScreen.ofPortfolio')}` : undefined}
          />
          <AccountSummaryTile
            label={t('accountsScreen.unrealizedPL')}
            value={formatPortfolioGainDisplay(totalGainPln, totalValuedHoldings, isPolish)}
            detail={describePortfolioGain(totalHoldings, totalValuedHoldings, isPolish, { cashExcluded: true })}
            tone={totalValuedHoldings === 0 ? 'default' : totalGainPln >= 0 ? 'success' : 'warning'}
          />
          <AccountSummaryTile
            label={t('accountsScreen.degradedAccounts')}
            value={String(degradedCount)}
            detail={degradedCount === 0
              ? t('accountsScreen.fullValuation')
              : t('accountsScreen.staleFallback')}
            tone={degradedCount === 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),26rem]">
        <div className="grid gap-6">
          <Card flush>
            <div className="border-b border-zinc-800 px-5 py-4">
              <SectionHeader
                eyebrow={t('accountsScreen.readModel')}
                title={t('accountsScreen.accountOverview')}
                description={t('accountsScreen.overviewDescription')}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span>
                  {t('accountsScreen.dragHint')}
                </span>
                {reorderAccountsMutation.isPending && (
                  <span className="text-blue-400">
                    {t('accountsScreen.savingOrder')}
                  </span>
                )}
                {reorderAccountsMutation.error && (
                  <span className="text-red-400">{reorderAccountsMutation.error.message}</span>
                )}
              </div>
            </div>

            {accounts.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title={t('accountsScreen.noAccountsTitle')}
                  description={t('accountsScreen.noAccountsDescription')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-950/30">
                    <tr>
                      <th className="w-14 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                        <span className="sr-only">{t('accountsScreen.order')}</span>
                      </th>
                      <th className={th}>{t('accountsScreen.accountColumn')}</th>
                      <th className={th}>{t('accountsScreen.type')}</th>
                      <th className={thRight}>{t('accountsScreen.holdingsColumn')}</th>
                      <th className={thRight}>{t('accountsScreen.cash')}</th>
                      <th className={thRight}>{t('accountsScreen.value')}</th>
                      <th className={thRight}>{t('accountsScreen.pl')}</th>
                      <th className={thRight}>{t('accountsScreen.statusColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedAccounts.map((account) => {
                      const gainPct = calculateGainPct(account.totalCurrentValuePln, account.totalBookValuePln)
                      const isSelected = selectedAccount?.accountId === account.accountId
                      const cashBreakdown = formatCurrencyBreakdown(account.cashBalances)
                      return (
                        <tr
                          className={`${tr} cursor-pointer ${draggedAccountId === account.accountId ? 'opacity-60' : ''} ${dropTargetAccountId === account.accountId ? 'bg-zinc-950/30' : ''} ${isSelected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : ''}`}
                          key={account.accountId}
                          aria-selected={isSelected}
                          onClick={() => setSelectedAccountId(account.accountId)}
                          onDragOver={(event) => {
                            event.preventDefault()
                            if (draggedAccountId && draggedAccountId !== account.accountId) {
                              setDropTargetAccountId(account.accountId)
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            handleDrop(account.accountId)
                          }}
                        >
                          <td className="w-14 px-3 py-3 text-sm">
                            <div
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50 transition ${
                                reorderAccountsMutation.isPending
                                  ? 'cursor-not-allowed text-zinc-700'
                                  : 'cursor-grab text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 active:cursor-grabbing'
                              }`}
                              draggable={!reorderAccountsMutation.isPending}
                              onClick={(event) => event.stopPropagation()}
                              onDragStart={(event) => {
                                event.stopPropagation()
                                setDraggedAccountId(account.accountId)
                              }}
                              onDragEnd={(event) => {
                                event.stopPropagation()
                                setDraggedAccountId(null)
                                setDropTargetAccountId(null)
                              }}
                              aria-label={isPolish
                                ? `Przeciągnij ${account.accountName}, aby zmienić kolejność`
                                : `Drag ${account.accountName} to reorder`}
                              title={isPolish
                                ? `Przeciągnij ${account.accountName}, aby zmienić kolejność`
                                : `Drag ${account.accountName} to reorder`}
                            >
                              <DragHandleIcon />
                            </div>
                          </td>
                          <td className={td}>
                            <div>
                              <p className="font-medium text-zinc-100">{account.accountName}</p>
                              <p className="text-xs text-zinc-500">
                                {account.institution} · {account.baseCurrency}
                              </p>
                            </div>
                          </td>
                          <td className={td}>
                            <div>
                              <p className="text-zinc-200">{labelAccountType(account.type)}</p>
                              <p className="text-xs text-zinc-500">
                                {formatPercent(account.portfolioWeightPct)} {t('accountsScreen.ofPortfolio')}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{account.activeHoldingCount}</p>
                              <p className="text-xs text-zinc-500">
                                {account.valuedHoldingCount}/{account.activeHoldingCount} {t('accountsScreen.marketBacked')}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(account.cashBalancePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {hasMeaningfulCurrencyBreakdown(account.cashBalances)
                                  ? cashBreakdown
                                  : `${t('accountsScreen.netContributions')} ${formatCurrencyPln(account.netContributionsPln)}`}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(account.totalCurrentValuePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {t('accountsScreen.invested')} {formatCurrencyPln(account.investedCurrentValuePln)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className={`tabular-nums ${
                                account.valuedHoldingCount === 0
                                  ? 'text-zinc-500'
                                  : parsePortfolioNumber(account.totalUnrealizedGainPln) >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                              }`}>
                                {formatPortfolioGainDisplay(parsePortfolioNumber(account.totalUnrealizedGainPln), account.valuedHoldingCount, isPolish)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {describeHoldingGainRate(account.activeHoldingCount, account.valuedHoldingCount, gainPct, isPolish)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <span className={`${badge} ${portfolioValuationStateVariant(account.valuationState)}`}>
                              {labelPortfolioValuationState(account.valuationState, isPolish)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selectedAccount && (
            <AccountDetailsCard
              account={selectedAccount}
              holdings={selectedAccountHoldings}
              isPolish={isPolish}
            />
          )}
        </div>

        <AccountsSection />
      </div>
    </>
  )

  function handleDrop(targetAccountId: string) {
    if (reorderAccountsMutation.isPending || draggedAccountId == null || draggedAccountId === targetAccountId) {
      setDraggedAccountId(null)
      setDropTargetAccountId(null)
      return
    }

    const currentIndex = orderedAccounts.findIndex((account) => account.accountId === draggedAccountId)
    const targetIndex = orderedAccounts.findIndex((account) => account.accountId === targetAccountId)

    setDraggedAccountId(null)
    setDropTargetAccountId(null)

    if (currentIndex < 0 || targetIndex < 0) {
      return
    }

    const insertionIndex = targetIndex
    if (currentIndex === insertionIndex) {
      return
    }

    persistOrder(moveItem(orderedAccounts, currentIndex, insertionIndex))
  }

  function persistOrder(nextAccounts: PortfolioAccountSummary[]) {
    const previousAccounts = orderedAccounts
    setOrderedAccounts(nextAccounts)
    reorderAccountsMutation.mutate(
      {
        accountIds: nextAccounts.map((account) => account.accountId),
      },
      {
        onError: () => {
          setOrderedAccounts(previousAccounts)
        },
      },
    )
  }
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)
  return nextItems
}
