import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PortfolioHolding } from '../api/read-model'
import { PageHeader } from '../components/layout'
import { Badge, FilterBar, EmptyState, ErrorState, LoadingState, StatePanel } from '../components/ui'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { missingDataLabel } from '../lib/availability'
import { formatCurrencyPln, formatDate, formatNumber, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { getActiveUiLanguage, useI18n } from '../lib/i18n'
import { labelAssetClass, labelInstrumentKind } from '../lib/labels'
import { usePersistentState } from '../lib/persistence'
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
  const { isPolish } = useI18n()
  const navigate = useNavigate()
  const holdingsQuery = usePortfolioHoldings()
  const holdings = holdingsQuery.data ?? []
  const [accountFilter, setAccountFilter] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.accountFilter, 'ALL', { validate: isStringValue })
  const [assetClassFilter, setAssetClassFilter] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.assetClassFilter, 'ALL', { validate: isStringValue })
  const [statusFilter, setStatusFilter] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.statusFilter, 'ALL', { validate: isStringValue })
  const [searchQuery, setSearchQuery] = usePersistentState(HOLDINGS_PREFERENCE_KEYS.searchQuery, '', { validate: isStringValue })
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null)
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
      <>
        <PageHeader title={isPolish ? 'Pozycje' : 'Holdings'} />
        <LoadingState
          title={isPolish ? 'Ładowanie pozycji' : 'Loading holdings'}
          description={isPolish
            ? 'Wyliczanie bieżących pozycji, statusu wyceny i ekspozycji kont.'
            : 'Resolving the current positions, valuation status and account exposure.'}
          blocks={4}
        />
      </>
    )
  }

  if (holdingsQuery.isError) {
    return (
      <>
        <PageHeader title={isPolish ? 'Pozycje' : 'Holdings'} />
        <ErrorState
          title={isPolish ? 'Pozycje niedostępne' : 'Holdings unavailable'}
          description={isPolish
            ? 'Nie udało się wczytać bieżących pozycji. Spróbuj ponownie albo sprawdź gotowość środowiska w Ustawieniach.'
            : 'Current positions could not load. Retry now or verify runtime readiness in Settings.'}
          onRetry={() => void holdingsQuery.refetch()}
        />
      </>
    )
  }

  if (holdings.length === 0) {
    return (
      <>
        <PageHeader title={isPolish ? 'Pozycje' : 'Holdings'} />
        <EmptyState
          title={isPolish ? 'Brak pozycji' : 'No holdings yet'}
          description={isPolish
            ? 'Portfel nie ma teraz aktywnych pozycji. Ten widok zapełni się po zapisaniu transakcji, które zostawiają otwartą pozycję; jeśli masz tylko gotówkę albo wszystko zostało już zamknięte, pozostanie pusty.'
            : 'The portfolio has no active holdings right now. This view fills after recording transactions that leave an open position; if you only hold cash or have already closed everything, it will stay empty.'}
          action={{ label: isPolish ? 'Przejdź do Transakcji' : 'Go to Transactions', to: '/transactions' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={isPolish ? 'Pozycje' : 'Holdings'}>
        <Badge variant="default">
          {activeFilterCount > 0
            ? isPolish
              ? `${filteredHoldings.length} z ${holdings.length} pozycji`
              : `${filteredHoldings.length} of ${holdings.length} positions`
            : `${holdings.length} ${isPolish ? 'pozycji' : 'positions'}`}
        </Badge>
        <span className="text-sm tabular-nums text-zinc-400">{formatCurrencyPln(totalValue)}</span>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HoldingSummaryTile
          label={isPolish ? 'Widoczne pozycje' : 'Visible holdings'}
          value={String(filteredHoldings.length)}
          detail={formatCurrencyPln(totalValue)}
        />
        <HoldingSummaryTile
          label={isPolish ? 'Rynkowo wycenione' : 'Market valued'}
          value={String(valuedCount)}
          detail={filteredHoldings.length > 0 ? `${formatPercentOf(valuedCount, filteredHoldings.length)} ${isPolish ? 'widoku' : 'of view'}` : undefined}
          tone={valuedCount === filteredHoldings.length ? 'success' : 'default'}
        />
        <HoldingSummaryTile
          label={isPolish ? 'Księgowe / częściowe' : 'Book basis / partial'}
          value={String(degradedCount)}
          detail={degradedCount > 0
            ? isPolish
              ? 'Brak pełnej wyceny rynkowej'
              : 'Full market valuation unavailable'
            : isPolish
              ? 'Pełna wycena rynkowa'
              : 'Full market valuation'}
          tone={degradedCount > 0 ? 'warning' : 'default'}
        />
        <HoldingSummaryTile
          label={isPolish ? 'Problemy danych' : 'Data issues'}
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
            label={isPolish ? 'Konto' : 'Account'}
            value={accountFilter}
            options={filterOptions.accounts}
            allLabel={isPolish ? 'Wszystkie konta' : 'All accounts'}
            onChange={setAccountFilter}
          />
          <FilterSelect
            label={isPolish ? 'Klasa' : 'Class'}
            value={assetClassFilter}
            options={filterOptions.assetClasses.map((c) => ({ value: c, label: labelAssetClass(c) }))}
            allLabel={isPolish ? 'Wszystkie klasy' : 'All classes'}
            onChange={setAssetClassFilter}
          />
          <FilterSelect
            label={isPolish ? 'Status' : 'Status'}
            value={statusFilter}
            options={filterOptions.statuses.map((status) => ({ value: status, label: valuationStatusFilterLabel(status, isPolish) }))}
            allLabel={isPolish ? 'Wszystkie statusy' : 'All statuses'}
            onChange={setStatusFilter}
          />
          <div>
            <span className={labelClass}>{isPolish ? 'Szukaj' : 'Search'}</span>
            <input
              type="search"
              className={filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isPolish ? 'Nazwa, konto, waluta...' : 'Name, account, currency...'}
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
          eyebrow={isPolish ? 'Przefiltrowane' : 'Filtered out'}
          title={isPolish ? 'Brak pozycji pasujących do filtrów' : 'No holdings match the current filters'}
          description={isPolish
            ? 'Wyczyść jeden lub kilka filtrów, aby przywrócić pozycje na widok.'
            : 'Clear one or more filters to bring positions back into view.'}
          action={{ label: isPolish ? 'Wyczyść filtry' : 'Clear filters', onClick: clearFilters }}
          className="py-10"
        />
      ) : (
        <div className={cardFlush}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  <SortableHeader sort={sortState} field="instrumentName" label={isPolish ? 'Instrument' : 'Instrument'} onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="accountName" label={isPolish ? 'Konto' : 'Account'} onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="assetClass" label={isPolish ? 'Klasa' : 'Class'} onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="quantity" label={isPolish ? 'Ilość' : 'Qty'} onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="currentValuePln" label={isPolish ? 'Wartość' : 'Value'} onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="unrealizedGainPln" label="P/L" onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="valuationStatus" label={isPolish ? 'Status' : 'Status'} onToggle={setSortState} />
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
                        isSelected ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'
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
                        <div className="font-medium text-zinc-100">{holding.instrumentName}</div>
                        <div className="text-xs text-zinc-500">
                          {labelInstrumentKind(holding.kind)} · {holding.currency}
                        </div>
                      </td>
                      <td className={`${td} text-zinc-300`}>{holding.accountName}</td>
                      <td className={td}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${assetClassDot(holding.assetClass)}`} />
                        <span className="text-zinc-400">{labelAssetClass(holding.assetClass)}</span>
                      </td>
                      <td className={tdRight}>{formatNumber(holding.quantity, { maximumFractionDigits: 6 })}</td>
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
                    {isPolish ? 'Suma' : 'Total'} ({filteredHoldings.length})
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
        <div className={`${card} mt-4`}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">{selectedHolding.instrumentName}</h3>
              <p className="mt-0.5 text-sm text-zinc-500">
                {selectedHolding.accountName} · {labelInstrumentKind(selectedHolding.kind)} · {labelAssetClass(selectedHolding.assetClass)}
              </p>
            </div>
            <span className={`${badge} ${holdingStatusPresentation(normalizedValuationStatus(selectedHolding.valuationStatus), isPolish).className}`}>
              {holdingStatusPresentation(normalizedValuationStatus(selectedHolding.valuationStatus), isPolish).label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <DetailStat label={isPolish ? 'Ilość' : 'Quantity'} value={formatNumber(selectedHolding.quantity, { maximumFractionDigits: 6 })} />
            <DetailStat label={isPolish ? 'Śr. koszt' : 'Avg Cost'} value={formatCurrencyPln(selectedHolding.averageCostPerUnitPln)} />
            <DetailStat label={isPolish ? 'Bieżąca cena' : 'Current Price'} value={formatCurrencyPln(selectedHolding.currentPricePln)} />
            <DetailStat label={isPolish ? 'Bieżąca wartość' : 'Current Value'} value={formatCurrencyPln(selectedHolding.currentValuePln ?? selectedHolding.bookValuePln)} />
            <DetailStat label={isPolish ? 'Wartość księgowa' : 'Book Value'} value={formatCurrencyPln(selectedHolding.bookValuePln)} />
            <DetailStat
              label={isPolish ? 'Niezrealizowany zysk/strata' : 'Unrealized P/L'}
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
                      {formatDate(lot.purchaseDate)} · {formatNumber(lot.quantity, { maximumFractionDigits: 0 })} {isPolish ? 'szt.' : 'units'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-zinc-100">{formatCurrencyPln(lot.currentValuePln ?? lot.costBasisPln)}</p>
                    {lot.currentRatePercent && (
                      <p className="text-xs text-zinc-400">
                        {isPolish ? 'Oprocentowanie' : 'Rate'}: {lot.currentRatePercent}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {isPolish ? 'Wykup EDO' : 'Redeem EDO'}
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
                    {isPolish ? 'Otwórz wykup' : 'Start redeem'}
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
            {isPolish ? 'Tryb wyceny' : 'Valuation mode'}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-100">
            {fullyBookBased
              ? (isPolish ? 'Widok opiera się obecnie na wartości księgowej.' : 'This view currently relies on book basis.')
              : staleCount > 0 && marketIssueCount + fxIssueCount === 0
                ? (isPolish ? 'Widok korzysta z ostatnich dostępnych cen rynkowych.' : 'This view uses the latest available market prices.')
              : (isPolish ? 'Widok miesza wyceny rynkowe z wartością księgową.' : 'This view mixes market prices with book basis.')}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {fullyBookBased
              ? (isPolish
                  ? 'Bieżący P/L wróci po odzyskaniu cen rynkowych i przeliczeń FX.'
                  : 'Live P/L returns once market quotes and FX coverage are back.')
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
    case 'valuationStatus': return f * valuationStatusFilterLabel(a.valuationStatus, getActiveUiLanguage() === 'pl').localeCompare(valuationStatusFilterLabel(b.valuationStatus, getActiveUiLanguage() === 'pl'))
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

function valuationStatusFilterLabel(value: string | null | undefined, isPolish: boolean) {
  switch (normalizedValuationStatus(value)) {
    case 'VALUED':
      return isPolish ? 'Rynkowa' : 'Market valued'
    case 'STALE':
      return isPolish ? 'Opóźniona' : 'Stale'
    case 'BOOK_ONLY':
      return isPolish ? 'Księgowa' : 'Book basis'
    case 'MISSING_MARKET_DATA':
      return isPolish ? 'Brak ceny' : 'Missing quote'
    case 'MISSING_FX':
      return isPolish ? 'Brak FX' : 'Missing FX'
    case 'UNSUPPORTED_CORRECTIONS':
      return isPolish ? 'Korekty' : 'Corrections'
    case 'UNAVAILABLE':
      return isPolish ? 'Brak wyceny' : 'No valuation'
    default:
      return value ?? (isPolish ? 'Brak wyceny' : 'No valuation')
  }
}

function holdingStatusPresentation(value: string | null | undefined, isPolish: boolean) {
  switch (normalizedValuationStatus(value)) {
    case 'VALUED':
      return { label: isPolish ? 'Rynkowa' : 'Market', className: badgeVariants.success }
    case 'STALE':
      return { label: isPolish ? 'Opóźniona' : 'Stale', className: badgeVariants.info }
    case 'BOOK_ONLY':
      return { label: isPolish ? 'Księgowa' : 'Book basis', className: badgeVariants.warning }
    case 'MISSING_MARKET_DATA':
      return { label: isPolish ? 'Brak ceny' : 'No quote', className: badgeVariants.default }
    case 'MISSING_FX':
      return { label: isPolish ? 'Brak FX' : 'Missing FX', className: badgeVariants.warning }
    case 'UNSUPPORTED_CORRECTIONS':
      return { label: isPolish ? 'Korekty' : 'Corrections', className: badgeVariants.error }
    case 'UNAVAILABLE':
      return { label: isPolish ? 'Brak wyceny' : 'No valuation', className: badgeVariants.default }
    default:
      return { label: valuationStatusFilterLabel(value, isPolish), className: badgeVariants.default }
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
