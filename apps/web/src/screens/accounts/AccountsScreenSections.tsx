import type { PortfolioAccountSummary, PortfolioHolding } from '../../api/read-model'
import { Card } from '../../components/ui'
import { formatCurrencyPln, formatPercent } from '../../lib/format'
import { labelAccountType, labelAssetClass } from '../../lib/labels'
import {
  describeHoldingGainValue,
  formatHoldingGainPreview,
  formatHoldingQuantity,
  labelPortfolioValuationState,
  parsePortfolioNumber,
  portfolioValuationStateVariant,
} from '../../lib/portfolio-presentation'
import { formatMessage, t } from '../../lib/messages'
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
  const largestHolding = holdings[0] ?? null
  const cashSharePct = parsePortfolioNumber(account.totalCurrentValuePln) > 0
    ? (parsePortfolioNumber(account.cashBalancePln) / parsePortfolioNumber(account.totalCurrentValuePln)) * 100
    : 0

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {t('accountDetails.selectedAccount')}
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
          label={t('accountDetails.cash')}
          value={formatCurrencyPln(account.cashBalancePln)}
          detail={formatPercent(cashSharePct)}
        />
        <AccountDetailMetric
          label={t('accountDetails.invested')}
          value={formatCurrencyPln(account.investedCurrentValuePln)}
          detail={formatMessage(t('accountDetails.holdingsCount'), { count: account.activeHoldingCount })}
          tone={account.valuedHoldingCount === 0 ? 'default' : parsePortfolioNumber(account.totalUnrealizedGainPln) >= 0 ? 'success' : 'warning'}
        />
        <AccountDetailMetric
          label={t('accountDetails.netContributions')}
          value={formatCurrencyPln(account.netContributionsPln)}
          detail={describeHoldingGainValue(account.activeHoldingCount, account.valuedHoldingCount, account.totalUnrealizedGainPln, isPolish)}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-zinc-100">{t('accountDetails.topPositions')}</h4>
          {largestHolding && (
            <p className="text-xs text-zinc-500">
              {t('accountDetails.largestLine')}: {largestHolding.instrumentName}
            </p>
          )}
        </div>

        {holdings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            {t('accountDetails.noPositions')}
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
                      {labelAssetClass(holding.assetClass)} · {formatHoldingQuantity(holding.quantity)} {t('accountDetails.units')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-zinc-100">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</p>
                    <p className="text-xs text-zinc-500">
                      {isMarketValuedStatus(holding.valuationStatus)
                        ? `${formatPercent(weightPct)} · ${formatHoldingGainPreview(holding.unrealizedGainPln, isPolish)}`
                        : `${formatPercent(weightPct)} · ${t('accountDetails.bookBasis')}`}
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



