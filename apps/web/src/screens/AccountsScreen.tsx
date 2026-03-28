import { useEffect, useMemo, useState } from 'react'
import type { PortfolioAccountSummary } from '../api/read-model'
import { AccountsSection } from '../components/AccountsSection'
import { PageHeader } from '../components/layout'
import { Card, EmptyState, ErrorState, LoadingState, SectionHeader, SortableHeader } from '../components/ui'
import type { SortState, SortDirection } from '../components/ui'
import { usePortfolioAccounts, usePortfolioHoldings } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAccountType } from '../lib/labels'
import { formatMessage, t } from '../lib/messages'
import { usePersistentState } from '../lib/persistence'
import {
  calculateGainPct,
  describeHoldingGainRate,
  describePortfolioGain,
  formatPortfolioGainDisplay,
  labelPortfolioValuationState,
  parsePortfolioNumber,
  portfolioValuationStateVariant,
} from '../lib/portfolio-presentation'
import { AccountDetailsCard, AccountSummaryTile } from './accounts/AccountsScreenSections'
import { badge, td, tdRight, thRight, tr } from '../lib/styles'

type AccountSortField =
  | 'accountName'
  | 'type'
  | 'holdingCount'
  | 'cashBalancePln'
  | 'totalCurrentValuePln'
  | 'unrealizedGainPln'

type AccountsSortState = SortState<AccountSortField>

const defaultSort: AccountsSortState = { field: 'totalCurrentValuePln', direction: 'desc' }

const ACCOUNTS_PREFERENCE_KEYS = {
  sortState: 'portfolio:view:accounts:sort-state',
} as const

export function AccountsScreen() {
  return (
    <>
      <PageHeader title={t('accountsScreen.title')} />
      <AccountsContent />
    </>
  )
}

export function AccountsContent() {
  const { isPolish } = useI18n()
  const accountsQuery = usePortfolioAccounts()
  const holdingsQuery = usePortfolioHoldings()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data])
  const [sortState, setSortState] = usePersistentState<AccountsSortState>(ACCOUNTS_PREFERENCE_KEYS.sortState, defaultSort, { validate: isAccountsSortState })
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const totalValuePln = accounts.reduce((sum, account) => sum + parsePortfolioNumber(account.totalCurrentValuePln), 0)
  const totalCashPln = accounts.reduce((sum, account) => sum + parsePortfolioNumber(account.cashBalancePln), 0)
  const totalGainPln = accounts.reduce((sum, account) => sum + parsePortfolioNumber(account.totalUnrealizedGainPln), 0)
  const degradedCount = accounts.filter((account) => account.valuationState !== 'MARK_TO_MARKET').length
  const totalHoldings = accounts.reduce((sum, account) => sum + account.activeHoldingCount, 0)
  const totalValuedHoldings = accounts.reduce((sum, account) => sum + account.valuedHoldingCount, 0)
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => compareAccounts(a, b, sortState)),
    [accounts, sortState],
  )
  const selectedAccount = sortedAccounts.find((account) => account.accountId === selectedAccountId) ?? sortedAccounts[0] ?? null
  const selectedAccountHoldings = useMemo(
    () => holdings
      .filter((holding) => holding.accountId === selectedAccount?.accountId)
      .sort((left, right) => parsePortfolioNumber(right.currentValuePln ?? right.bookValuePln) - parsePortfolioNumber(left.currentValuePln ?? left.bookValuePln)),
    [holdings, selectedAccount?.accountId],
  )

  useEffect(() => {
    if (sortedAccounts.length === 0) {
      setSelectedAccountId(null)
      return
    }

    if (!selectedAccountId || !sortedAccounts.some((account) => account.accountId === selectedAccountId)) {
      setSelectedAccountId(sortedAccounts[0]?.accountId ?? null)
    }
  }, [sortedAccounts, selectedAccountId])

  if (accountsQuery.isLoading || holdingsQuery.isLoading) {
    return (
      <LoadingState
        title={t('accountsScreen.loadingTitle')}
        description={t('accountsScreen.loadingDescription')}
        blocks={4}
      />
    )
  }

  if (accountsQuery.isError || holdingsQuery.isError) {
    return (
      <ErrorState
        title={t('accountsScreen.errorTitle')}
        description={t('accountsScreen.errorDescription')}
        onRetry={() => void Promise.all([accountsQuery.refetch(), holdingsQuery.refetch()])}
      />
    )
  }

  return (
    <>

      {accounts.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AccountSummaryTile
            label={t('accountsScreen.accountValue')}
            value={formatCurrencyPln(totalValuePln)}
            detail={formatMessage(t('accountsScreen.activeHoldings'), { count: totalHoldings })}
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
                      <SortableHeader sort={sortState} field="accountName" label={t('accountsScreen.accountColumn')} onToggle={setSortState} />
                      <SortableHeader sort={sortState} field="type" label={t('accountsScreen.type')} onToggle={setSortState} />
                      <SortableHeader sort={sortState} field="holdingCount" label={t('accountsScreen.holdingsColumn')} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="cashBalancePln" label={t('accountsScreen.cash')} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="totalCurrentValuePln" label={t('accountsScreen.value')} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="unrealizedGainPln" label={t('accountsScreen.pl')} onToggle={setSortState} align="right" />
                      <th className={thRight}>{t('accountsScreen.statusColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAccounts.map((account) => {
                      const gainPct = calculateGainPct(account.totalCurrentValuePln, account.totalBookValuePln)
                      const isSelected = selectedAccount?.accountId === account.accountId
                      return (
                        <tr
                          className={`${tr} cursor-pointer ${isSelected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : ''}`}
                          key={account.accountId}
                          aria-selected={isSelected}
                          onClick={() => setSelectedAccountId(account.accountId)}
                        >
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
                                {t('accountsScreen.netContributions')} {formatCurrencyPln(account.netContributionsPln)}
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
}

function isAccountSortField(value: unknown): value is AccountSortField {
  return value === 'accountName'
    || value === 'type'
    || value === 'holdingCount'
    || value === 'cashBalancePln'
    || value === 'totalCurrentValuePln'
    || value === 'unrealizedGainPln'
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc'
}

function isAccountsSortState(value: unknown): value is AccountsSortState {
  if (typeof value !== 'object' || value == null) {
    return false
  }

  const candidate = value as Partial<AccountsSortState>
  return isAccountSortField(candidate.field) && isSortDirection(candidate.direction)
}

function compareAccounts(a: PortfolioAccountSummary, b: PortfolioAccountSummary, sort: AccountsSortState) {
  const f = sort.direction === 'asc' ? 1 : -1
  switch (sort.field) {
    case 'accountName': return f * a.accountName.localeCompare(b.accountName)
    case 'type': return f * labelAccountType(a.type).localeCompare(labelAccountType(b.type))
    case 'holdingCount': return f * (a.activeHoldingCount - b.activeHoldingCount)
    case 'cashBalancePln': return f * (parsePortfolioNumber(a.cashBalancePln) - parsePortfolioNumber(b.cashBalancePln))
    case 'totalCurrentValuePln': return f * (parsePortfolioNumber(a.totalCurrentValuePln) - parsePortfolioNumber(b.totalCurrentValuePln))
    case 'unrealizedGainPln': {
      const gainA = parsePortfolioNumber(a.totalCurrentValuePln) - parsePortfolioNumber(a.totalBookValuePln)
      const gainB = parsePortfolioNumber(b.totalCurrentValuePln) - parsePortfolioNumber(b.totalBookValuePln)
      return f * (gainA - gainB)
    }
    default: return 0
  }
}
