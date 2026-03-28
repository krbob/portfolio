import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PortfolioHolding } from '../api/read-model'
import { PageHeader } from '../components/layout'
import { FilterBar, EmptyState, ErrorState, LoadingState, StatePanel } from '../components/ui'
import { useAppMeta } from '../hooks/use-app-meta'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { useInstruments } from '../hooks/use-write-model'
import { missingDataLabel } from '../lib/availability'
import { formatCurrency, formatCurrencyPln, formatDate, formatNumber, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAssetClass, labelInstrumentKind } from '../lib/labels'
import { formatMessage, t } from '../lib/messages'
import { usePersistentState } from '../lib/persistence'
import { buildStockAnalystAnalysisUrl } from '../lib/stock-analyst'
import type { TransactionRouteState } from '../lib/transaction-composer'
import { isMarketValuedStatus } from '../lib/valuation'
import {
  btnGhost, btnPrimary, card, cardFlush, th, thRight, td, tdRight, tr,
  filterInput, label as labelClass, badge, badgeVariants,
} from '../lib/styles'

type SortField =
  | 'instrumentName'
  | 'accountName'
  | 'assetClass'
  | 'quantity'
  | 'currentValuePln'
  | 'unrealizedGainPln'
  | 'valuationStatus'

type SortDirection = 'asc' | 'desc'

interface SortState {
  field: SortField
  direction: SortDirection
}

const defaultSort: SortState = { field: 'currentValuePln', direction: 'desc' }

const HOLDINGS_PREFERENCE_KEYS = {
  accountFilter: 'portfolio:view:holdings:account-filter',
  assetClassFilter: 'portfolio:view:holdings:asset-class-filter',
  statusFilter: 'portfolio:view:holdings:status-filter',
  searchQuery: 'portfolio:view:holdings:search-query',
  sortState: 'portfolio:view:holdings:sort-state',
} as const

export function HoldingsScreen() {
  return (
    <>
      <PageHeader title={t('holdings.title')} />
      <HoldingsContent />
    </>
  )
}

export function HoldingsContent() {
  const { isPolish } = useI18n()
  const navigate = useNavigate()
  const appMetaQuery = useAppMeta()
  const holdingsQuery = usePortfolioHoldings()
  const instrumentsQuery = useInstruments()
  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data])
  const instrumentsById = useMemo(
    () => new Map((instrumentsQuery.data ?? []).map((instrument) => [instrument.id, instrument])),
    [instrumentsQuery.data],
  )
  const [accountFilter, setAccountFilter] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.accountFilter, 'ALL', { validate: isStringValue })
  const [assetClassFilter, setAssetClassFilter] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.assetClassFilter, 'ALL', { validate: isStringValue })
  const [statusFilter, setStatusFilter] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.statusFilter, 'ALL', { validate: isStringValue })
  const [searchQuery, setSearchQuery] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.searchQuery, '', { validate: isStringValue })
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null)
  const holdingDetailRef = useRef<HTMLDivElement>(null)
  const [sortState, setSortState] = usePersistentState<SortState>(HOLDINGS_PREFERENCE_KEYS.sortState, defaultSort, { validate: isSortState })
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())

  const filterOptions = useMemo(
    () => ({
      accounts: uniqueValues(holdings.map((h) => h.accountName)),
      assetClasses: uniqueValues(holdings.map((h) => h.assetClass)),
      statuses: uniqueValues(holdings.map((h) => h.valuationStatus ?? 'UNAVAILABLE')),
    }),
    [holdings],
  )

  useEffect(() => {
    if (holdingsQuery.isLoading) {
      return
    }

    if (accountFilter !== 'ALL' && !filterOptions.accounts.includes(accountFilter)) {
      setAccountFilter('ALL')
    }
  }, [accountFilter, filterOptions.accounts, holdingsQuery.isLoading, setAccountFilter])

  useEffect(() => {
    if (holdingsQuery.isLoading) {
      return
    }

    if (assetClassFilter !== 'ALL' && !filterOptions.assetClasses.includes(assetClassFilter)) {
      setAssetClassFilter('ALL')
    }
  }, [assetClassFilter, filterOptions.assetClasses, holdingsQuery.isLoading, setAssetClassFilter])

  useEffect(() => {
    if (holdingsQuery.isLoading) {
      return
    }

    if (statusFilter !== 'ALL' && !filterOptions.statuses.includes(statusFilter)) {
      setStatusFilter('ALL')
    }
  }, [filterOptions.statuses, holdingsQuery.isLoading, setStatusFilter, statusFilter])

  useEffect(() => {
    if (selectedHoldingKey && holdingDetailRef.current?.scrollIntoView) {
      holdingDetailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedHoldingKey])

  const activeFilterCount =
    (accountFilter !== 'ALL' ? 1 : 0) +
    (assetClassFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (deferredSearch ? 1 : 0)

  const filteredHoldings = useMemo(() => {
    const visible = holdings.filter((h) => {
      if (accountFilter !== 'ALL' && h.accountName !== accountFilter) return false
      if (assetClassFilter !== 'ALL' && h.assetClass !== assetClassFilter) return false
      if (statusFilter !== 'ALL' && (h.valuationStatus ?? 'UNAVAILABLE') !== statusFilter) return false
      if (!deferredSearch) return true
      return [h.instrumentName, h.accountName, h.assetClass, h.kind, h.currency]
        .join(' ')
        .toLowerCase()
        .includes(deferredSearch)
    })
    return [...visible].sort((a, b) => compareHoldings(a, b, sortState))
  }, [accountFilter, assetClassFilter, deferredSearch, holdings, sortState, statusFilter])

  const selectedHolding =
    filteredHoldings.find((h) => holdingKey(h) === selectedHoldingKey) ?? null
  const selectedHoldingInstrument = selectedHolding ? instrumentsById.get(selectedHolding.instrumentId) ?? null : null
  const stockAnalystAnalysisUrl = buildStockAnalystAnalysisUrl(
    appMetaQuery.data?.stockAnalystUiUrl,
    selectedHoldingInstrument?.valuationSource === 'STOCK_ANALYST' ? selectedHoldingInstrument.symbol : null,
  )

  const totalValue = filteredHoldings.reduce(
    (sum, h) => sum + asNumber(h.currentValuePln ?? h.bookValuePln ?? '0'),
    0,
  )
  const valuedCount = filteredHoldings.filter((h) => isMarketValuedStatus(normalizedValuationStatus(h.valuationStatus))).length
  const staleCount = filteredHoldings.filter((h) => normalizedValuationStatus(h.valuationStatus) === 'STALE').length
  const degradedCount = filteredHoldings.length - valuedCount
  const fxIssueCount = filteredHoldings.filter((h) => normalizedValuationStatus(h.valuationStatus) === 'MISSING_FX').length
  const marketIssueCount = filteredHoldings.filter((h) => {
    const status = normalizedValuationStatus(h.valuationStatus)
    return status === 'UNAVAILABLE' || status === 'MISSING_MARKET_DATA'
  }).length

  function clearFilters() {
    setAccountFilter('ALL')
    setAssetClassFilter('ALL')
    setStatusFilter('ALL')
    setSearchQuery('')
  }

  if (holdingsQuery.isLoading) {
    return (
      <LoadingState
        title={t('holdings.loadingTitle')}
        description={t('holdings.loadingDescription')}
        blocks={4}
      />
    )
  }

  if (holdingsQuery.isError) {
    return (
      <ErrorState
        title={t('holdings.errorTitle')}
        description={t('holdings.errorDescription')}
        onRetry={() => void holdingsQuery.refetch()}
      />
    )
  }

  if (holdings.length === 0) {
    return (
      <EmptyState
        title={t('holdings.emptyTitle')}
        description={t('holdings.emptyDescription')}
        action={{ label: t('holdings.emptyAction'), to: '/transactions' }}
      />
    )
  }

  return (
    <>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HoldingSummaryTile
          label={t('holdings.visibleHoldings')}
          value={String(filteredHoldings.length)}
          detail={formatCurrencyPln(totalValue)}
        />
        <HoldingSummaryTile
          label={t('holdings.marketValued')}
          value={String(valuedCount)}
          detail={filteredHoldings.length > 0 ? `${formatPercentOf(valuedCount, filteredHoldings.length)} ${t('holdings.ofView')}` : undefined}
          tone={valuedCount === filteredHoldings.length ? 'success' : 'default'}
        />
        <HoldingSummaryTile
          label={t('holdings.bookBasisPartial')}
          value={String(degradedCount)}
          detail={degradedCount > 0
            ? t('holdings.fullMarketUnavailable')
            : t('holdings.fullMarketValuation')}
          tone={degradedCount > 0 ? 'warning' : 'default'}
        />
        <HoldingSummaryTile
          label={t('holdings.dataIssues')}
          value={String(marketIssueCount + fxIssueCount + staleCount)}
          detail={isPolish
            ? `${marketIssueCount} cen · ${fxIssueCount} FX · ${staleCount} opóźnionych`
            : `${marketIssueCount} quotes · ${fxIssueCount} FX · ${staleCount} stale`}
          tone={marketIssueCount + fxIssueCount + staleCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Filters */}
      {holdings.length > 5 && (
        <FilterBar
          activeCount={activeFilterCount}
          onClear={clearFilters}
          summary={activeFilterCount > 0
            ? isPolish
              ? `${filteredHoldings.length} z ${holdings.length} pozycji`
              : `${filteredHoldings.length} of ${holdings.length} positions`
            : undefined}
        >
          <FilterSelect
            label={t('holdings.filterAccount')}
            value={accountFilter}
            options={filterOptions.accounts}
            allLabel={t('holdings.filterAllAccounts')}
            onChange={setAccountFilter}
          />
          <FilterSelect
            label={t('holdings.filterClass')}
            value={assetClassFilter}
            options={filterOptions.assetClasses.map((c) => ({ value: c, label: labelAssetClass(c) }))}
            allLabel={t('holdings.filterAllClasses')}
            onChange={setAssetClassFilter}
          />
          <FilterSelect
            label={t('holdings.filterStatus')}
            value={statusFilter}
            options={filterOptions.statuses.map((status) => ({ value: status, label: valuationStatusFilterLabel(status) }))}
            allLabel={t('holdings.filterAllStatuses')}
            onChange={setStatusFilter}
          />
          <div>
            <span className={labelClass}>{t('holdings.filterSearch')}</span>
            <input
              type="search"
              className={filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('holdings.filterSearchPlaceholder')}
            />
          </div>
        </FilterBar>
      )}

      {filteredHoldings.length > 0 && (degradedCount > 0 || staleCount > 0) ? (
        <HoldingsValuationBanner
          totalCount={filteredHoldings.length}
          valuedCount={valuedCount}
          staleCount={staleCount}
          marketIssueCount={marketIssueCount}
          fxIssueCount={fxIssueCount}
          isPolish={isPolish}
        />
      ) : null}

      {/* Table */}
      {filteredHoldings.length === 0 ? (
        <StatePanel
          eyebrow={t('holdings.filteredEyebrow')}
          title={t('holdings.filteredTitle')}
          description={t('holdings.filteredDescription')}
          action={{ label: t('holdings.clearFilters'), onClick: clearFilters }}
          className="py-10"
        />
      ) : (
        <div className={cardFlush}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  <SortableHeader sort={sortState} field="instrumentName" label={t('holdings.instrument')} onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="accountName" label={t('holdings.account')} onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="assetClass" label={t('holdings.class')} onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="quantity" label={t('holdings.qty')} onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="currentValuePln" label={t('holdings.value')} onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="unrealizedGainPln" label="P/L" onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="valuationStatus" label={t('holdings.status')} onToggle={setSortState} />
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map((holding) => {
                  const key = holdingKey(holding)
                  const status = normalizedValuationStatus(holding.valuationStatus)
                  const isSelected = key === selectedHoldingKey
                  const gainPln = holding.unrealizedGainPln
                  const gainPct = holdingGainPercent(holding)
                  const statusPresentation = holdingStatusPresentation(status, isPolish)

                  return (
                    <tr
                      key={key}
                      className={`${tr} cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : 'hover:bg-zinc-800/30'
                      }`}
                      onClick={() => setSelectedHoldingKey(key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedHoldingKey(key)
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className={td}>
                        <span className="block max-w-[16rem] truncate font-medium text-zinc-100" title={holding.instrumentName}>{holding.instrumentName}</span>
                        <div className="text-xs text-zinc-500">
                          {labelInstrumentKind(holding.kind)} · {holding.currency}
                        </div>
                      </td>
                      <td className={`${td} text-zinc-300`}>{holding.accountName}</td>
                      <td className={td}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${assetClassDot(holding.assetClass)}`} />
                        <span className="text-zinc-400">{labelAssetClass(holding.assetClass)}</span>
                      </td>
                      <td className={tdRight}>{formatNumber(holding.quantity, { maximumFractionDigits: 0 })}</td>
                      <td className={`${tdRight} font-medium text-zinc-100`}>
                        {formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}
                      </td>
                      <td className={`${tdRight} font-medium ${gainColor(gainPln)}`}>
                        <div>{gainPln == null ? missingDataLabel(isPolish) : formatSignedCurrencyPln(gainPln)}</div>
                        {gainPct != null ? (
                          <div className="mt-0.5 text-xs font-normal text-zinc-500">
                            {formatPercent(gainPct, { signed: true, scale: 100, maximumFractionDigits: 2 })}
                          </div>
                        ) : null}
                      </td>
                      <td className={td}>
                        <span className={`${badge} ${statusPresentation.className}`}>
                          {statusPresentation.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-700 bg-zinc-900">
                  <td className={`${td} font-medium text-zinc-300`} colSpan={4}>
                    {t('holdings.total')} ({filteredHoldings.length})
                  </td>
                  <td className={`${tdRight} font-bold text-zinc-100`}>{formatCurrencyPln(totalValue)}</td>
                  <td className={tdRight} />
                  <td className={td} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Selected holding detail */}
      {selectedHolding && (
        <div ref={holdingDetailRef} className={`${card} mt-4`}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">{selectedHolding.instrumentName}</h3>
              <p className="mt-0.5 text-sm text-zinc-500">
                {selectedHolding.accountName} · {labelInstrumentKind(selectedHolding.kind)} · {labelAssetClass(selectedHolding.assetClass)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {stockAnalystAnalysisUrl ? (
                <a
                  href={stockAnalystAnalysisUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={btnGhost}
                >
                  {t('instrumentDetails.openStockAnalyst')}
                </a>
              ) : null}
              <span className={`${badge} ${holdingStatusPresentation(normalizedValuationStatus(selectedHolding.valuationStatus), isPolish).className}`}>
                {holdingStatusPresentation(normalizedValuationStatus(selectedHolding.valuationStatus), isPolish).label}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <DetailStat label={t('holdings.quantity')} value={formatNumber(selectedHolding.quantity, { maximumFractionDigits: 0 })} />
            <DetailStat
              label={t('holdings.avgCostPlnPerUnit')}
              value={formatCurrencyPln(selectedHolding.averageCostPerUnitPln)}
              detail={selectedHolding.currency !== 'PLN'
                ? formatMessage(t('holdings.instrumentCurrency'), { currency: selectedHolding.currency })
                : null}
            />
            <DetailStat
              label={t('holdings.currentPrice')}
              value={formatHoldingCurrentPrice(selectedHolding)}
              detail={formatHoldingCurrentPriceDetail(selectedHolding)}
            />
            <DetailStat label={t('holdings.currentValue')} value={formatCurrencyPln(selectedHolding.currentValuePln ?? selectedHolding.bookValuePln)} />
            <DetailStat label={t('holdings.bookValue')} value={formatCurrencyPln(selectedHolding.bookValuePln)} />
            <DetailStat
              label={t('holdings.unrealizedPL')}
              value={selectedHolding.unrealizedGainPln == null
                ? missingDataLabel(isPolish)
                : formatSignedCurrencyPln(selectedHolding.unrealizedGainPln)}
              detail={formatHoldingGainPercent(selectedHolding)}
              className={gainColor(selectedHolding.unrealizedGainPln)}
            />
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            {isPolish
              ? `${selectedHolding.transactionCount} transakcji · ${selectedHolding.currency}`
              : `${selectedHolding.transactionCount} transactions · ${selectedHolding.currency}`}
            {selectedHolding.valuedAt
              ? isPolish
                ? ` · wycena ${formatDate(selectedHolding.valuedAt)}`
                : ` · valued ${formatDate(selectedHolding.valuedAt)}`
              : ''}
          </div>
          {selectedHolding.valuationIssue && (
            <p className={`mt-2 text-sm ${issueToneClass(normalizedValuationStatus(selectedHolding.valuationStatus))}`}>{selectedHolding.valuationIssue}</p>
          )}
          {selectedHolding.kind === 'BOND_EDO' && (selectedHolding.edoLots?.length ?? 0) > 0 ? (
            <div className="mt-4 space-y-3">
              {selectedHolding.edoLots?.map((lot) => (
                <div
                  key={`${lot.purchaseDate}-${lot.quantity}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {formatDate(lot.purchaseDate)} · {formatNumber(lot.quantity, { maximumFractionDigits: 0 })} {t('holdings.units')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-zinc-100">{formatCurrencyPln(lot.currentValuePln ?? lot.costBasisPln)}</p>
                    {lot.currentRatePercent && (
                      <p className="text-xs text-zinc-400">
                        {t('holdings.rate')}: {formatNumber(lot.currentRatePercent, { maximumFractionDigits: 2 })}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {t('holdings.redeemEdo')}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {isPolish
                        ? `${selectedHolding.edoLots?.length ?? 0} aktywne partie${selectedHolding.edoLots?.[0]?.purchaseDate ? ` od ${formatDate(selectedHolding.edoLots[0].purchaseDate)}` : ''}. Otwórz wykup z już wybraną serią i kontem.`
                        : `${selectedHolding.edoLots?.length ?? 0} active lots${selectedHolding.edoLots?.[0]?.purchaseDate ? ` starting from ${formatDate(selectedHolding.edoLots[0].purchaseDate)}` : ''}. Open redemption with this series and account preselected.`}
                    </p>
                  </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => openRedeemFlow(selectedHolding)}
                  >
                    {t('holdings.startRedeem')}
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => openRedeemFlow(selectedHolding, selectedHolding.quantity)}
                  >
                    {isPolish
                      ? `Wykup wszystko (${formatNumber(selectedHolding.quantity, { maximumFractionDigits: 0 })} szt.)`
                      : `Redeem all (${formatNumber(selectedHolding.quantity, { maximumFractionDigits: 0 })} units)`}
                  </button>
                </div>
              </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  )

  function openRedeemFlow(holding: PortfolioHolding, quantity?: string) {
    const state: TransactionRouteState = {
      transactionDraft: {
        accountId: holding.accountId,
        instrumentId: holding.instrumentId,
        type: 'REDEEM',
        quantity,
        currency: holding.currency,
      },
    }

    navigate('/transactions', { state })
  }
}

function formatHoldingCurrentPrice(holding: PortfolioHolding) {
  if (holding.currentPriceNative != null) {
    return formatCurrency(holding.currentPriceNative, holding.currency)
  }

  return formatCurrencyPln(holding.currentPricePln)
}

function formatHoldingCurrentPriceDetail(holding: PortfolioHolding) {
  if (holding.currentPriceNative != null && holding.currency !== 'PLN' && holding.currentPricePln != null) {
    return `${t('holdings.currentPricePlnPerUnit')}: ${formatCurrencyPln(holding.currentPricePln)}`
  }

  if (holding.currentPriceNative == null && holding.currency !== 'PLN') {
    return formatMessage(t('holdings.instrumentCurrency'), { currency: holding.currency })
  }

  return null
}

// --- Sub-components ---

function DetailStat({
  label,
  value,
  detail,
  className,
}: {
  label: string
  value: string
  detail?: string | null
  className?: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium tabular-nums ${className ?? 'text-zinc-100'}`}>{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-zinc-500">{detail}</p> : null}
    </div>
  )
}

function HoldingSummaryTile({
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
  const toneClass = tone === 'success'
    ? 'text-emerald-400'
    : tone === 'warning'
      ? 'text-amber-400'
      : 'text-zinc-100'

  return (
    <div className={card}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {detail ? <p className="mt-1 text-sm text-zinc-500">{detail}</p> : null}
    </div>
  )
}

function HoldingsValuationBanner({
  totalCount,
  valuedCount,
  staleCount,
  marketIssueCount,
  fxIssueCount,
  isPolish,
}: {
  totalCount: number
  valuedCount: number
  staleCount: number
  marketIssueCount: number
  fxIssueCount: number
  isPolish: boolean
}) {
  const fullyBookBased = valuedCount === 0

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-300/80">
            {t('holdings.valuationMode')}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-100">
            {fullyBookBased
              ? t('holdings.bookBasisView')
              : staleCount > 0 && marketIssueCount + fxIssueCount === 0
                ? t('holdings.staleView')
              : t('holdings.mixedView')}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {fullyBookBased
              ? t('holdings.bookBasisReturnHint')
              : staleCount > 0 && marketIssueCount + fxIssueCount === 0
                ? (isPolish
                    ? `${valuedCount} z ${totalCount} pozycji ma wycenę rynkową, w tym ${staleCount} opóźnionych.`
                    : `${valuedCount} of ${totalCount} holdings have market valuation, including ${staleCount} stale.`)
              : (isPolish
                  ? `${valuedCount} z ${totalCount} pozycji ma wycenę rynkową.`
                  : `${valuedCount} of ${totalCount} holdings have market valuation.`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {staleCount > 0 ? (
            <span className={`${badge} ${badgeVariants.info}`}>
              {isPolish ? `${staleCount} opóźnionych` : `${staleCount} stale`}
            </span>
          ) : null}
          {marketIssueCount > 0 ? (
            <span className={`${badge} ${badgeVariants.warning}`}>
              {isPolish ? `${marketIssueCount} bez ceny` : `${marketIssueCount} without quote`}
            </span>
          ) : null}
          {fxIssueCount > 0 ? (
            <span className={`${badge} ${badgeVariants.warning}`}>
              {isPolish ? `${fxIssueCount} bez FX` : `${fxIssueCount} missing FX`}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string
  value: string
  options: string[] | { value: string; label: string }[]
  allLabel: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <select className={filterInput} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="ALL">{allLabel}</option>
        {options.map((opt) => {
          const v = typeof opt === 'string' ? opt : opt.value
          const l = typeof opt === 'string' ? opt : opt.label
          return (
            <option key={v} value={v}>
              {l}
            </option>
          )
        })}
      </select>
    </div>
  )
}

function SortableHeader({
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

// --- Utilities ---

function isStringValue(value: unknown): value is string {
  return typeof value === 'string'
}

function isSortField(value: unknown): value is SortField {
  return value === 'instrumentName'
    || value === 'accountName'
    || value === 'assetClass'
    || value === 'quantity'
    || value === 'currentValuePln'
    || value === 'unrealizedGainPln'
    || value === 'valuationStatus'
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc'
}

function isSortState(value: unknown): value is SortState {
  if (typeof value !== 'object' || value == null) {
    return false
  }

  const candidate = value as Partial<SortState>
  return isSortField(candidate.field) && isSortDirection(candidate.direction)
}

function compareHoldings(a: PortfolioHolding, b: PortfolioHolding, sort: SortState) {
  const f = sort.direction === 'asc' ? 1 : -1
  switch (sort.field) {
    case 'instrumentName': return f * a.instrumentName.localeCompare(b.instrumentName)
    case 'accountName': return f * a.accountName.localeCompare(b.accountName)
    case 'assetClass': return f * labelAssetClass(a.assetClass).localeCompare(labelAssetClass(b.assetClass))
    case 'valuationStatus': return f * valuationStatusFilterLabel(a.valuationStatus).localeCompare(valuationStatusFilterLabel(b.valuationStatus))
    case 'quantity': return f * (asNumber(a.quantity) - asNumber(b.quantity))
    case 'unrealizedGainPln': return f * (asNumber(a.unrealizedGainPln) - asNumber(b.unrealizedGainPln))
    case 'currentValuePln': return f * (asNumber(a.currentValuePln ?? a.bookValuePln) - asNumber(b.currentValuePln ?? b.bookValuePln))
    default: return 0
  }
}

function asNumber(v: string | null | undefined) {
  return v == null || v === '' ? 0 : Number(v)
}

function holdingGainPercent(holding: PortfolioHolding) {
  const gain = holding.unrealizedGainPln
  const costBasis = asNumber(holding.costBasisPln)

  if (gain == null || costBasis <= 0) {
    return null
  }

  return asNumber(gain) / costBasis
}

function formatHoldingGainPercent(holding: PortfolioHolding) {
  const gainPct = holdingGainPercent(holding)
  if (gainPct == null) {
    return null
  }

  return formatPercent(gainPct, {
    signed: true,
    scale: 100,
    maximumFractionDigits: 2,
  })
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function holdingKey(h: PortfolioHolding) {
  return `${h.accountId}:${h.instrumentId}`
}

function assetClassDot(c: string) {
  switch (c) {
    case 'EQUITIES': return 'bg-blue-500'
    case 'BONDS': return 'bg-amber-500'
    case 'CASH': return 'bg-zinc-500'
    default: return 'bg-zinc-600'
  }
}

function gainColor(v: string | null | undefined) {
  if (v == null) return 'text-zinc-500'
  const n = Number(v)
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-red-400'
  return 'text-zinc-400'
}

function formatPercentOf(part: number, total: number) {
  if (total <= 0) {
    return '0%'
  }
  return `${Math.round((part / total) * 100)}%`
}

function normalizedValuationStatus(value: string | null | undefined) {
  return value ?? 'UNAVAILABLE'
}

function valuationStatusFilterLabel(value: string | null | undefined) {
  switch (normalizedValuationStatus(value)) {
    case 'VALUED':
      return t('holdings.filterValued')
    case 'STALE':
      return t('holdings.filterStale')
    case 'BOOK_ONLY':
      return t('holdings.filterBookOnly')
    case 'MISSING_MARKET_DATA':
      return t('holdings.filterMissingMarket')
    case 'MISSING_FX':
      return t('holdings.filterMissingFx')
    case 'UNSUPPORTED_CORRECTIONS':
      return t('holdings.filterCorrections')
    case 'UNAVAILABLE':
      return t('holdings.filterUnavailable')
    default:
      return value ?? t('holdings.filterUnavailable')
  }
}

function holdingStatusPresentation(value: string | null | undefined, _isPolish?: boolean) {
  switch (normalizedValuationStatus(value)) {
    case 'VALUED':
      return { label: t('holdings.statusValued'), className: badgeVariants.success }
    case 'STALE':
      return { label: t('holdings.statusStale'), className: badgeVariants.info }
    case 'BOOK_ONLY':
      return { label: t('holdings.statusBookOnly'), className: badgeVariants.warning }
    case 'MISSING_MARKET_DATA':
      return { label: t('holdings.statusMissingMarket'), className: badgeVariants.default }
    case 'MISSING_FX':
      return { label: t('holdings.statusMissingFx'), className: badgeVariants.warning }
    case 'UNSUPPORTED_CORRECTIONS':
      return { label: t('holdings.statusCorrections'), className: badgeVariants.error }
    case 'UNAVAILABLE':
      return { label: t('holdings.statusUnavailable'), className: badgeVariants.default }
    default:
      return { label: valuationStatusFilterLabel(value), className: badgeVariants.default }
  }
}

function issueToneClass(value: string | null | undefined) {
  switch (normalizedValuationStatus(value)) {
    case 'UNSUPPORTED_CORRECTIONS':
      return 'text-red-400'
    case 'STALE':
    case 'MISSING_FX':
    case 'MISSING_MARKET_DATA':
    case 'UNAVAILABLE':
    case 'BOOK_ONLY':
      return 'text-amber-300'
    default:
      return 'text-zinc-500'
  }
}
