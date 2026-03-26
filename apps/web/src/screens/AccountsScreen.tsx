import { useEffect, useMemo, useState } from 'react'
import type { PortfolioAccountSummary, PortfolioHolding } from '../api/read-model'
import { AccountsSection } from '../components/AccountsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { usePortfolioAccounts, usePortfolioHoldings } from '../hooks/use-read-model'
import { useReorderAccounts } from '../hooks/use-write-model'
import { formatCurrency, formatCurrencyBreakdown, formatCurrencyPln, formatPercent, formatSignedCurrencyPln, hasMeaningfulCurrencyBreakdown } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAccountType, labelAssetClass } from '../lib/labels'
import { badge, badgeVariants, td, tdRight, th, thRight, tr } from '../lib/styles'
import { isMarketValuedStatus } from '../lib/valuation'

export function AccountsScreen() {
  const { isPolish } = useI18n()
  const accountsQuery = usePortfolioAccounts()
  const holdingsQuery = usePortfolioHoldings()
  const reorderAccountsMutation = useReorderAccounts()
  const accounts = accountsQuery.data ?? []
  const holdings = holdingsQuery.data ?? []
  const [orderedAccounts, setOrderedAccounts] = useState(accounts)
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null)
  const [dropTargetAccountId, setDropTargetAccountId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const totalValuePln = accounts.reduce((sum, account) => sum + asNumber(account.totalCurrentValuePln), 0)
  const totalCashPln = accounts.reduce((sum, account) => sum + asNumber(account.cashBalancePln), 0)
  const totalGainPln = accounts.reduce((sum, account) => sum + asNumber(account.totalUnrealizedGainPln), 0)
  const degradedCount = accounts.filter((account) => account.valuationState !== 'MARK_TO_MARKET').length
  const totalHoldings = accounts.reduce((sum, account) => sum + account.activeHoldingCount, 0)
  const totalValuedHoldings = accounts.reduce((sum, account) => sum + account.valuedHoldingCount, 0)
  const selectedAccount = orderedAccounts.find((account) => account.accountId === selectedAccountId) ?? orderedAccounts[0] ?? null
  const selectedAccountHoldings = useMemo(
    () => holdings
      .filter((holding) => holding.accountId === selectedAccount?.accountId)
      .sort((left, right) => asNumber(right.currentValuePln ?? right.bookValuePln) - asNumber(left.currentValuePln ?? left.bookValuePln)),
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
        <PageHeader title={isPolish ? 'Konta' : 'Accounts'} />
        <LoadingState
          title={isPolish ? 'Ładowanie kont' : 'Loading accounts'}
          description={isPolish
            ? 'Budowanie widoku rachunków, sald gotówki i bieżącej wartości.'
            : 'Building the account view, cash balances and current value.'}
          blocks={4}
        />
      </>
    )
  }

  if (accountsQuery.isError || holdingsQuery.isError) {
    return (
      <>
        <PageHeader title={isPolish ? 'Konta' : 'Accounts'} />
        <ErrorState
          title={isPolish ? 'Konta niedostępne' : 'Accounts unavailable'}
          description={isPolish
            ? 'Nie udało się wczytać agregatów per rachunek. Spróbuj ponownie albo sprawdź stan systemu.'
            : 'Per-account aggregates could not load. Retry now or inspect system health.'}
          onRetry={() => void accountsQuery.refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={isPolish ? 'Konta' : 'Accounts'}>
        <Badge variant="default">
          {accounts.length} {isPolish ? (accounts.length === 1 ? 'konto' : 'konta') : 'accounts'}
        </Badge>
        {accounts.length > 0 && (
          <span className="text-sm tabular-nums text-zinc-400">{formatCurrencyPln(totalValuePln)}</span>
        )}
      </PageHeader>

      {accounts.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AccountSummaryTile
            label={isPolish ? 'Wartość rachunków' : 'Account value'}
            value={formatCurrencyPln(totalValuePln)}
            detail={isPolish ? `${totalHoldings} pozycji aktywnych` : `${totalHoldings} active holdings`}
          />
          <AccountSummaryTile
            label={isPolish ? 'Gotówka na rachunkach' : 'Cash on accounts'}
            value={formatCurrencyPln(totalCashPln)}
            detail={totalValuePln > 0 ? `${formatPercent((totalCashPln / totalValuePln) * 100)} ${isPolish ? 'portfela' : 'of portfolio'}` : undefined}
          />
          <AccountSummaryTile
            label={isPolish ? 'Niezrealizowany P/L pozycji' : 'Unrealized holdings P/L'}
            value={formatGainDisplay(totalGainPln, totalValuedHoldings, isPolish)}
            detail={describePortfolioGain(totalHoldings, totalValuedHoldings, isPolish)}
            tone={totalValuedHoldings === 0 ? 'default' : totalGainPln >= 0 ? 'success' : 'warning'}
          />
          <AccountSummaryTile
            label={isPolish ? 'Konta zdegradowane' : 'Degraded accounts'}
            value={String(degradedCount)}
            detail={degradedCount === 0
              ? (isPolish ? 'Pełna wycena na wszystkich rachunkach' : 'Full valuation on every account')
              : (isPolish ? 'Część rachunków używa wyceny opóźnionej albo księgowej' : 'Some accounts use stale or book valuation')}
            tone={degradedCount === 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),26rem]">
        <div className="grid gap-6">
          <Card flush>
            <div className="border-b border-zinc-800 px-5 py-4">
              <SectionHeader
                eyebrow={isPolish ? 'Read model' : 'Read model'}
                title={isPolish ? 'Przegląd rachunków' : 'Account overview'}
                description={isPolish
                  ? 'Wartość, gotówka i status wyceny rozbite na rachunki z ręcznym sterowaniem kolejnością.'
                  : 'Value, cash and valuation status split by account, with manual ordering controlled from this view.'}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span>
                  {isPolish
                    ? 'Przeciągnij uchwyt po lewej, aby ustawić kolejność kont.'
                    : 'Drag the handle on the left to set the account order.'}
                </span>
                {reorderAccountsMutation.isPending && (
                  <span className="text-blue-400">
                    {isPolish ? 'Zapisywanie kolejności...' : 'Saving order...'}
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
                  title={isPolish ? 'Brak kont' : 'No accounts yet'}
                  description={isPolish
                    ? 'Dodaj pierwszy rachunek po prawej stronie, aby zacząć przypisywać do niego transakcje.'
                    : 'Add the first account on the right to start assigning transactions to it.'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-950/30">
                    <tr>
                      <th className="w-14 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                        <span className="sr-only">{isPolish ? 'Kolejność' : 'Order'}</span>
                      </th>
                      <th className={th}>{isPolish ? 'Konto' : 'Account'}</th>
                      <th className={th}>{isPolish ? 'Typ' : 'Type'}</th>
                      <th className={thRight}>{isPolish ? 'Pozycje' : 'Holdings'}</th>
                      <th className={thRight}>{isPolish ? 'Gotówka' : 'Cash'}</th>
                      <th className={thRight}>{isPolish ? 'Wartość' : 'Value'}</th>
                      <th className={thRight}>{isPolish ? 'P/L' : 'P/L'}</th>
                      <th className={thRight}>{isPolish ? 'Status' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedAccounts.map((account) => {
                      const gainPct = toGainPct(account.totalCurrentValuePln, account.totalBookValuePln)
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
                                {formatPercent(account.portfolioWeightPct)} {isPolish ? 'portfela' : 'of portfolio'}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{account.activeHoldingCount}</p>
                              <p className="text-xs text-zinc-500">
                                {account.valuedHoldingCount}/{account.activeHoldingCount} {isPolish ? 'z wyceną rynkową' : 'market-backed'}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(account.cashBalancePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {hasMeaningfulCurrencyBreakdown(account.cashBalances)
                                  ? cashBreakdown
                                  : `${isPolish ? 'Wpłaty netto' : 'Net contributions'} ${formatCurrencyPln(account.netContributionsPln)}`}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(account.totalCurrentValuePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {isPolish ? 'Zainwestowane' : 'Invested'} {formatCurrencyPln(account.investedCurrentValuePln)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className={`tabular-nums ${
                                account.valuedHoldingCount === 0
                                  ? 'text-zinc-500'
                                  : asNumber(account.totalUnrealizedGainPln) >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                              }`}>
                                {formatGainDisplay(asNumber(account.totalUnrealizedGainPln), account.valuedHoldingCount, isPolish)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {describeAccountGain(account.activeHoldingCount, account.valuedHoldingCount, gainPct, isPolish)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <span className={`${badge} ${valuationStateVariant(account.valuationState)}`}>
                              {labelValuationState(account.valuationState, isPolish)}
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

function AccountSummaryTile({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${
        tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-300' : 'text-zinc-50'
      }`}>
        {value}
      </p>
      {detail && <p className="mt-2 text-sm text-zinc-500">{detail}</p>}
    </Card>
  )
}

function AccountDetailsCard({
  account,
  holdings,
  isPolish,
}: {
  account: PortfolioAccountSummary
  holdings: PortfolioHolding[]
  isPolish: boolean
}) {
  const cashBreakdown = formatCurrencyBreakdown(account.cashBalances)
  const contributionBreakdown = formatCurrencyBreakdown(account.netContributionBalances)
  const largestHolding = holdings[0] ?? null
  const cashSharePct = asNumber(account.totalCurrentValuePln) > 0
    ? (asNumber(account.cashBalancePln) / asNumber(account.totalCurrentValuePln)) * 100
    : 0
  const showBreakdownPanels =
    hasMeaningfulCurrencyBreakdown(account.cashBalances) ||
    hasMeaningfulCurrencyBreakdown(account.netContributionBalances)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {isPolish ? 'Wybrane konto' : 'Selected account'}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-50">{account.accountName}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {account.institution} · {labelAccountType(account.type)} · {account.baseCurrency}
          </p>
        </div>
        <span className={`${badge} ${valuationStateVariant(account.valuationState)}`}>
          {labelValuationState(account.valuationState, isPolish)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <AccountDetailMetric
          label={isPolish ? 'Gotówka' : 'Cash'}
          value={formatCurrencyPln(account.cashBalancePln)}
          detail={cashBreakdown ?? formatPercent(cashSharePct)}
        />
        <AccountDetailMetric
          label={isPolish ? 'Zainwestowane' : 'Invested'}
          value={formatCurrencyPln(account.investedCurrentValuePln)}
          detail={isPolish ? `${account.activeHoldingCount} pozycji` : `${account.activeHoldingCount} holdings`}
        />
        <AccountDetailMetric
          label={isPolish ? 'Wpłaty netto' : 'Net contributions'}
          value={formatCurrencyPln(account.netContributionsPln)}
          detail={contributionBreakdown ?? describeAccountMetricGain(account, isPolish)}
          tone={account.valuedHoldingCount === 0 ? 'default' : asNumber(account.totalUnrealizedGainPln) >= 0 ? 'success' : 'warning'}
        />
      </div>

      {showBreakdownPanels && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CurrencyBreakdownCard
            title={isPolish ? 'Salda natywne' : 'Native cash balances'}
            items={account.cashBalances}
            isPolish={isPolish}
          />
          <CurrencyBreakdownCard
            title={isPolish ? 'Wpłaty netto wg waluty' : 'Net contributions by currency'}
            items={account.netContributionBalances}
            isPolish={isPolish}
          />
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-zinc-100">{isPolish ? 'Top pozycje' : 'Top positions'}</h4>
          {largestHolding && (
            <p className="text-xs text-zinc-500">
              {isPolish ? 'Największa linia' : 'Largest line'}: {largestHolding.instrumentName}
            </p>
          )}
        </div>

        {holdings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            {isPolish
              ? 'Na tym rachunku nie ma jeszcze aktywnych pozycji. Wartość pochodzi wyłącznie z gotówki.'
              : 'This account has no active positions yet. Its value currently comes from cash only.'}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {holdings.slice(0, 5).map((holding) => {
              const weightPct = asNumber(account.totalCurrentValuePln) > 0
                ? (asNumber(holding.currentValuePln ?? holding.bookValuePln) / asNumber(account.totalCurrentValuePln)) * 100
                : 0
              return (
                <div
                  key={`${holding.accountId}-${holding.instrumentId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{holding.instrumentName}</p>
                    <p className="text-xs text-zinc-500">
                      {labelAssetClass(holding.assetClass)} · {holding.quantity} {isPolish ? 'szt.' : 'units'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-zinc-100">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</p>
                    <p className="text-xs text-zinc-500">
                      {isMarketValuedStatus(holding.valuationStatus)
                        ? `${formatPercent(weightPct)} · ${formatSignedCurrencyPln(holding.unrealizedGainPln ?? '0')}`
                        : `${formatPercent(weightPct)} · ${isPolish ? 'księgowo' : 'book basis'}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

function AccountDetailMetric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${
        tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-300' : 'text-zinc-50'
      }`}>
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
    </div>
  )
}

function CurrencyBreakdownCard({
  title,
  items,
  isPolish,
}: {
  title: string
  items: PortfolioAccountSummary['cashBalances'] | PortfolioAccountSummary['netContributionBalances'] | undefined
  isPolish: boolean
}) {
  const rows = items ?? []

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          {isPolish ? 'Brak danych walutowych.' : 'No currency data yet.'}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div className="flex items-center justify-between gap-3" key={`${title}-${row.currency}`}>
              <span className="text-sm text-zinc-400">{row.currency}</span>
              <div className="text-right">
                <p className="tabular-nums text-sm font-medium text-zinc-100">
                  {formatCurrency(row.amount, row.currency)}
                </p>
                <p className="text-xs text-zinc-500">
                  {isPolish ? 'księgowo' : 'book'} {formatCurrencyPln(row.bookValuePln)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DragHandleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatGainDisplay(value: number, valuedHoldingCount: number, isPolish: boolean) {
  if (valuedHoldingCount === 0) {
    return isPolish ? 'b/d' : 'N/A'
  }

  return formatSignedCurrencyPln(value)
}

function describePortfolioGain(activeHoldingCount: number, valuedHoldingCount: number, isPolish: boolean) {
  if (activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (valuedHoldingCount === 0) {
    return isPolish
      ? 'Brak wyceny rynkowej aktywnych pozycji'
      : 'No market valuation for active holdings'
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return isPolish
      ? `${valuedHoldingCount}/${activeHoldingCount} pozycji z wyceną rynkową · gotówka wyłączona`
      : `${valuedHoldingCount}/${activeHoldingCount} holdings with market valuation · cash excluded`
  }

  return isPolish ? 'Tylko aktywne pozycje · gotówka wyłączona' : 'Active holdings only · cash excluded'
}

function describeAccountGain(
  activeHoldingCount: number,
  valuedHoldingCount: number,
  gainPct: number | null,
  isPolish: boolean,
) {
  if (activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (valuedHoldingCount === 0) {
    return isPolish ? 'Brak wyceny rynkowej' : 'No market valuation'
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return isPolish
      ? `${valuedHoldingCount}/${activeHoldingCount} pozycji wycenionych`
      : `${valuedHoldingCount}/${activeHoldingCount} holdings valued`
  }

  return gainPct == null ? (isPolish ? 'n/d' : 'n/a') : formatPercent(gainPct, { signed: true })
}

function describeAccountMetricGain(account: PortfolioAccountSummary, isPolish: boolean) {
  if (account.activeHoldingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (account.valuedHoldingCount === 0) {
    return isPolish ? 'Brak wyceny rynkowej pozycji' : 'No market valuation for holdings'
  }

  return formatSignedCurrencyPln(account.totalUnrealizedGainPln)
}

function toGainPct(currentValuePln: string, bookValuePln: string) {
  const current = asNumber(currentValuePln)
  const book = asNumber(bookValuePln)
  if (book <= 0) {
    return null
  }
  return ((current - book) / book) * 100
}

function labelValuationState(valuationState: string, isPolish: boolean) {
  switch (valuationState) {
    case 'MARK_TO_MARKET':
      return isPolish ? 'Rynkowa' : 'Market'
    case 'STALE':
      return isPolish ? 'Opóźniona' : 'Stale'
    case 'PARTIALLY_VALUED':
      return isPolish ? 'Częściowa' : 'Partial'
    case 'BOOK_ONLY':
      return isPolish ? 'Księgowa' : 'Book'
    default:
      return valuationState
  }
}

function valuationStateVariant(valuationState: string) {
  switch (valuationState) {
    case 'MARK_TO_MARKET':
      return badgeVariants.success
    case 'STALE':
      return badgeVariants.info
    case 'PARTIALLY_VALUED':
      return badgeVariants.warning
    case 'BOOK_ONLY':
      return badgeVariants.warning
    default:
      return badgeVariants.default
  }
}

function asNumber(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return 0
  }

  return typeof value === 'number' ? value : Number(value)
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)
  return nextItems
}
