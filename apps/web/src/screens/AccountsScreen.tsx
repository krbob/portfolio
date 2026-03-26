import { AccountsSection } from '../components/AccountsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { usePortfolioAccounts } from '../hooks/use-read-model'
import { formatCurrencyPln, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAccountType } from '../lib/labels'
import { badge, badgeVariants, td, tdRight, th, thRight, tr } from '../lib/styles'

export function AccountsScreen() {
  const { isPolish } = useI18n()
  const accountsQuery = usePortfolioAccounts()
  const accounts = accountsQuery.data ?? []
  const totalValuePln = accounts.reduce((sum, account) => sum + asNumber(account.totalCurrentValuePln), 0)
  const totalCashPln = accounts.reduce((sum, account) => sum + asNumber(account.cashBalancePln), 0)
  const totalGainPln = accounts.reduce((sum, account) => sum + asNumber(account.totalUnrealizedGainPln), 0)
  const degradedCount = accounts.filter((account) => account.valuationState !== 'MARK_TO_MARKET').length
  const totalHoldings = accounts.reduce((sum, account) => sum + account.activeHoldingCount, 0)

  if (accountsQuery.isLoading) {
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

  if (accountsQuery.isError) {
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
            label={isPolish ? 'Niezrealizowany P/L' : 'Unrealized P/L'}
            value={formatSignedCurrencyPln(totalGainPln)}
            detail={isPolish ? 'Suma pozycji i gotówki per konto' : 'Aggregated across account cash and positions'}
            tone={totalGainPln >= 0 ? 'success' : 'warning'}
          />
          <AccountSummaryTile
            label={isPolish ? 'Konta zdegradowane' : 'Degraded accounts'}
            value={String(degradedCount)}
            detail={degradedCount === 0
              ? (isPolish ? 'Pełna wycena na wszystkich rachunkach' : 'Full valuation on every account')
              : (isPolish ? 'Część rachunków używa podstawy księgowej' : 'Some accounts still rely on book basis')}
            tone={degradedCount === 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),26rem]">
        <Card flush>
          <div className="border-b border-zinc-800 px-5 py-4">
            <SectionHeader
              eyebrow={isPolish ? 'Read model' : 'Read model'}
              title={isPolish ? 'Przegląd rachunków' : 'Account overview'}
              description={isPolish
                ? 'Wartość, gotówka i bieżący wynik rozbite na rachunki, zanim dojdzie drag and drop kolejności.'
                : 'Value, cash and current P/L split by account before manual ordering lands.'}
            />
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
                  {accounts.map((account) => {
                    const gainPct = toGainPct(account.totalCurrentValuePln, account.totalBookValuePln)
                    return (
                      <tr className={tr} key={account.accountId}>
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
                              {account.valuedHoldingCount}/{account.activeHoldingCount} {isPolish ? 'wycen' : 'valued'}
                            </p>
                          </div>
                        </td>
                        <td className={tdRight}>
                          <div>
                            <p className="tabular-nums text-zinc-100">{formatCurrencyPln(account.cashBalancePln)}</p>
                            <p className="text-xs text-zinc-500">
                              {isPolish ? 'Wpłaty netto' : 'Net contributions'} {formatCurrencyPln(account.netContributionsPln)}
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
                            <p className={`tabular-nums ${asNumber(account.totalUnrealizedGainPln) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatSignedCurrencyPln(account.totalUnrealizedGainPln)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {gainPct == null ? (isPolish ? 'n/d' : 'n/a') : formatPercent(gainPct, { signed: true })}
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

        <AccountsSection />
      </div>
    </>
  )
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
