import type { PortfolioAccountSummary, PortfolioHolding } from '../../api/read-model'
import { Card } from '../../components/ui'
import { formatCurrency, formatCurrencyBreakdown, formatCurrencyPln, formatPercent, hasMeaningfulCurrencyBreakdown } from '../../lib/format'
import { labelAccountType, labelAssetClass } from '../../lib/labels'
import {
  describeHoldingGainValue,
  formatHoldingGainPreview,
  formatHoldingQuantity,
  labelPortfolioValuationState,
  parsePortfolioNumber,
  portfolioValuationStateVariant,
} from '../../lib/portfolio-presentation'
import { badge } from '../../lib/styles'
import { isMarketValuedStatus } from '../../lib/valuation'

export function AccountSummaryTile({
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

export function AccountDetailsCard({
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
  const cashSharePct = parsePortfolioNumber(account.totalCurrentValuePln) > 0
    ? (parsePortfolioNumber(account.cashBalancePln) / parsePortfolioNumber(account.totalCurrentValuePln)) * 100
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
        <span className={`${badge} ${portfolioValuationStateVariant(account.valuationState)}`}>
          {labelPortfolioValuationState(account.valuationState, isPolish)}
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
          detail={contributionBreakdown ?? describeHoldingGainValue(account.activeHoldingCount, account.valuedHoldingCount, account.totalUnrealizedGainPln, isPolish)}
          tone={account.valuedHoldingCount === 0 ? 'default' : parsePortfolioNumber(account.totalUnrealizedGainPln) >= 0 ? 'success' : 'warning'}
        />
      </div>

      {showBreakdownPanels && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CurrencyBreakdownCard
            title={isPolish ? 'Salda według walut' : 'Native cash balances'}
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
          <h4 className="text-sm font-medium text-zinc-100">{isPolish ? 'Największe pozycje' : 'Top positions'}</h4>
          {largestHolding && (
            <p className="text-xs text-zinc-500">
              {isPolish ? 'Największa pozycja' : 'Largest line'}: {largestHolding.instrumentName}
            </p>
          )}
        </div>

        {holdings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            {isPolish
              ? 'Na tym rachunku nie ma jeszcze aktywnych pozycji. Jego wartość pochodzi na razie wyłącznie z gotówki.'
              : 'This account has no active positions yet. Its value currently comes from cash only.'}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {holdings.slice(0, 5).map((holding) => {
              const weightPct = parsePortfolioNumber(account.totalCurrentValuePln) > 0
                ? (parsePortfolioNumber(holding.currentValuePln ?? holding.bookValuePln) / parsePortfolioNumber(account.totalCurrentValuePln)) * 100
                : 0
              return (
                <div
                  key={`${holding.accountId}-${holding.instrumentId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{holding.instrumentName}</p>
                    <p className="text-xs text-zinc-500">
                      {labelAssetClass(holding.assetClass)} · {formatHoldingQuantity(holding.quantity)} {isPolish ? 'szt.' : 'units'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-zinc-100">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</p>
                    <p className="text-xs text-zinc-500">
                      {isMarketValuedStatus(holding.valuationStatus)
                        ? `${formatPercent(weightPct)} · ${formatHoldingGainPreview(holding.unrealizedGainPln, isPolish)}`
                        : `${formatPercent(weightPct)} · ${isPolish ? 'wycena księgowa' : 'book basis'}`}
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
          {isPolish ? 'Brak rozbicia walutowego.' : 'No currency data yet.'}
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
                  {isPolish ? 'wartość księgowa' : 'book'} {formatCurrencyPln(row.bookValuePln)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DragHandleIcon() {
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
