import type { PortfolioHolding } from '../../api/read-model'
import { Card } from '../../components/ui'
import { formatCurrencyPln, formatDate, formatNumber } from '../../lib/format'
import { labelAssetClass, labelInstrumentKind, labelValuationSource } from '../../lib/labels'
import { t } from '../../lib/messages'
import {
  describeHoldingGainRate,
  formatHoldingGainPreview,
  formatHoldingQuantity,
} from '../../lib/portfolio-presentation'
import { badge, th, thRight } from '../../lib/styles'
import { isMarketValuedStatus } from '../../lib/valuation'
import type { InstrumentRow, SortField, SortState } from './InstrumentsScreenModel'
import { labelInstrumentStatus, statusVariant } from './InstrumentsScreenModel'

export function InstrumentSummaryTile({
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

export function InstrumentDetailsCard({
  row,
  holdings,
  isPolish,
}: {
  row: InstrumentRow
  holdings: PortfolioHolding[]
  isPolish: boolean
}) {
  const edoLots = holdings.flatMap((holding) => (holding.edoLots ?? []).map((lot) => ({
    accountId: holding.accountId,
    accountName: holding.accountName,
    ...lot,
  }))).sort((left, right) => left.purchaseDate.localeCompare(right.purchaseDate))

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {t('instrumentDetails.selectedInstrument')}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-50">{row.instrument.name}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {labelInstrumentKind(row.instrument.kind)} · {labelAssetClass(row.instrument.assetClass)} · {row.instrument.currency}
          </p>
        </div>
        <span className={`${badge} ${statusVariant(row.status)}`}>
          {labelInstrumentStatus(row.status, isPolish)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <InstrumentDetailMetric
          label={t('instrumentDetails.activeAccounts')}
          value={String(row.accountCount)}
          detail={row.accountCount === 0
            ? t('instrumentDetails.catalogOnly')
            : `${row.transactionCount} ${t('instrumentDetails.transactions')}`}
        />
        <InstrumentDetailMetric
          label={t('instrumentDetails.totalQuantity')}
          value={row.accountCount === 0 ? '0' : formatHoldingQuantity(row.quantity)}
          detail={`${t('instrumentDetails.cost')} ${formatCurrencyPln(row.totalBookValuePln)}`}
        />
        <InstrumentDetailMetric
          label={t('instrumentDetails.currentValue')}
          value={formatCurrencyPln(row.totalCurrentValuePln)}
          detail={describeHoldingGainRate(row.holdingCount, row.valuedHoldingCount, row.gainPct, isPolish)}
          tone={row.valuedHoldingCount === 0 ? 'default' : row.totalUnrealizedGainPln >= 0 ? 'success' : 'warning'}
        />
      </div>

      {row.instrument.edoTerms && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {t('instrumentDetails.firstPeriodRate')}
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-50">
              {formatNumber(row.instrument.edoTerms.firstPeriodRateBps / 100, { maximumFractionDigits: 2 })}%
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {t('instrumentDetails.margin')}
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-50">
              {formatNumber(row.instrument.edoTerms.marginBps / 100, { maximumFractionDigits: 2 })}%
            </p>
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-zinc-100">{t('instrumentDetails.accountSplit')}</h4>
          <p className="text-xs text-zinc-500">{labelValuationSource(row.instrument.valuationSource)}</p>
        </div>

        {holdings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            {t('instrumentDetails.noCatalogHoldings')}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {holdings.map((holding) => (
              <div
                key={`${holding.accountId}-${holding.instrumentId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">{holding.accountName}</p>
                  <p className="text-xs text-zinc-500">
                    {formatHoldingQuantity(holding.quantity)} {t('instrumentDetails.units')} · {holding.transactionCount} {t('instrumentDetails.transactions')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-zinc-100">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</p>
                  <p className="text-xs text-zinc-500">
                    {isMarketValuedStatus(holding.valuationStatus)
                      ? formatHoldingGainPreview(holding.unrealizedGainPln, isPolish)
                      : t('instrumentDetails.bookBasis')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {edoLots.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-zinc-100">{t('instrumentDetails.edoLots')}</h4>
          <div className="mt-3 space-y-2">
            {edoLots.map((lot) => (
              <div
                key={`${lot.accountId}-${lot.purchaseDate}-${lot.quantity}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">{lot.accountName}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(lot.purchaseDate)} · {formatHoldingQuantity(lot.quantity)} {t('instrumentDetails.units')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-zinc-100">{formatCurrencyPln(lot.currentValuePln ?? lot.costBasisPln)}</p>
                  <p className="text-xs text-zinc-500">
                    {isMarketValuedStatus(lot.valuationStatus)
                      ? formatHoldingGainPreview(lot.unrealizedGainPln, isPolish)
                      : t('instrumentDetails.bookBasis')}
                  </p>
                  {lot.currentRatePercent && (
                    <p className="text-xs text-zinc-400">
                      {t('instrumentDetails.rate')}: {formatNumber(lot.currentRatePercent, { maximumFractionDigits: 2 })}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export function SortableHeader({
  sort,
  field,
  label,
  onToggle,
  align,
}: {
  sort: SortState
  field: SortField
  label: string
  onToggle: (s: SortState) => void
  align?: 'right'
}) {
  const isActive = sort.field === field
  const arrow = !isActive ? '↕' : sort.direction === 'asc' ? '↑' : '↓'
  const base = align === 'right' ? thRight : th

  return (
    <th className={base}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${isActive ? 'text-zinc-300' : ''}`}
        onClick={() =>
          onToggle({ field, direction: isActive && sort.direction === 'desc' ? 'asc' : 'desc' })
        }
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  )
}

function InstrumentDetailMetric({
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
