import { useDeferredValue, useMemo, useState } from 'react'
import type { PortfolioHolding } from '../api/read-model'
import { PageHeader } from '../components/layout'
import { Badge, FilterBar, EmptyState } from '../components/ui'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { formatCurrencyPln, formatDate, formatNumber, formatSignedCurrencyPln } from '../lib/format'
import {
  card, cardFlush, th, thRight, td, tdRight, tr,
  filterInput, label as labelClass,
  valuationBadgeVariants,
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

export function HoldingsScreen() {
  const holdingsQuery = usePortfolioHoldings()
  const holdings = holdingsQuery.data ?? []
  const [accountFilter, setAccountFilter] = useState('ALL')
  const [assetClassFilter, setAssetClassFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null)
  const [sortState, setSortState] = useState<SortState>(defaultSort)
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())

  const filterOptions = useMemo(
    () => ({
      accounts: uniqueValues(holdings.map((h) => h.accountName)),
      assetClasses: uniqueValues(holdings.map((h) => h.assetClass)),
      statuses: uniqueValues(holdings.map((h) => h.valuationStatus ?? 'UNAVAILABLE')),
    }),
    [holdings],
  )

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

  function clearFilters() {
    setAccountFilter('ALL')
    setAssetClassFilter('ALL')
    setStatusFilter('ALL')
    setSearchQuery('')
  }

  if (holdingsQuery.isLoading) {
    return (
      <>
        <PageHeader title="Holdings" />
        <div className={`${cardFlush} h-96 animate-pulse`} />
      </>
    )
  }

  if (holdings.length === 0) {
    return (
      <>
        <PageHeader title="Holdings" />
        <EmptyState
          title="No holdings yet"
          description="Add accounts and instruments in Settings, then record transactions to see your positions here."
          action={{ label: 'Go to Settings', to: '/settings' }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Holdings">
        <Badge variant="default">{holdings.length} positions</Badge>
        <span className="text-sm tabular-nums text-zinc-400">{formatCurrencyPln(totalValue)}</span>
      </PageHeader>

      {/* Filters */}
      {holdings.length > 5 && (
        <FilterBar
          activeCount={activeFilterCount}
          onClear={clearFilters}
          summary={activeFilterCount > 0 ? `${filteredHoldings.length} of ${holdings.length} positions` : undefined}
        >
          <FilterSelect
            label="Account"
            value={accountFilter}
            options={filterOptions.accounts}
            allLabel="All accounts"
            onChange={setAccountFilter}
          />
          <FilterSelect
            label="Class"
            value={assetClassFilter}
            options={filterOptions.assetClasses.map((c) => ({ value: c, label: assetClassLabel(c) }))}
            allLabel="All classes"
            onChange={setAssetClassFilter}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            options={filterOptions.statuses}
            allLabel="All statuses"
            onChange={setStatusFilter}
          />
          <div>
            <span className={labelClass}>Search</span>
            <input
              type="search"
              className={filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, account, currency..."
            />
          </div>
        </FilterBar>
      )}

      {/* Table */}
      {filteredHoldings.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">No holdings match the current filters.</p>
      ) : (
        <div className={cardFlush}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  <SortableHeader sort={sortState} field="instrumentName" label="Instrument" onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="accountName" label="Account" onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="assetClass" label="Class" onToggle={setSortState} />
                  <SortableHeader sort={sortState} field="quantity" label="Qty" onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="currentValuePln" label="Value" onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="unrealizedGainPln" label="P/L" onToggle={setSortState} align="right" />
                  <SortableHeader sort={sortState} field="valuationStatus" label="Status" onToggle={setSortState} />
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map((holding) => {
                  const key = holdingKey(holding)
                  const status = holding.valuationStatus ?? 'UNAVAILABLE'
                  const isSelected = key === selectedHoldingKey
                  const gainPln = holding.unrealizedGainPln

                  return (
                    <tr
                      key={key}
                      className={`${tr} cursor-pointer transition-colors ${
                        isSelected ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'
                      }`}
                      onClick={() => setSelectedHoldingKey(key)}
                    >
                      <td className={td}>
                        <div className="font-medium text-zinc-100">{holding.instrumentName}</div>
                        <div className="text-xs text-zinc-500">
                          {holding.kind} · {holding.currency}
                        </div>
                      </td>
                      <td className={`${td} text-zinc-300`}>{holding.accountName}</td>
                      <td className={td}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${assetClassDot(holding.assetClass)}`} />
                        <span className="text-zinc-400">{assetClassLabel(holding.assetClass)}</span>
                      </td>
                      <td className={tdRight}>{formatNumber(holding.quantity, { maximumFractionDigits: 6 })}</td>
                      <td className={`${tdRight} font-medium text-zinc-100`}>
                        {formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}
                      </td>
                      <td className={`${tdRight} font-medium ${gainColor(gainPln)}`}>
                        {formatSignedCurrencyPln(gainPln)}
                      </td>
                      <td className={td}>
                        <span className={valuationBadgeVariants[status] ?? valuationBadgeVariants.UNAVAILABLE}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-700 bg-zinc-900">
                  <td className={`${td} font-medium text-zinc-300`} colSpan={4}>
                    Total ({filteredHoldings.length})
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
                {selectedHolding.accountName} · {selectedHolding.kind} · {assetClassLabel(selectedHolding.assetClass)}
              </p>
            </div>
            <span className={valuationBadgeVariants[selectedHolding.valuationStatus] ?? valuationBadgeVariants.UNAVAILABLE}>
              {selectedHolding.valuationStatus ?? 'UNAVAILABLE'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <DetailStat label="Quantity" value={formatNumber(selectedHolding.quantity, { maximumFractionDigits: 6 })} />
            <DetailStat label="Avg Cost" value={formatCurrencyPln(selectedHolding.averageCostPerUnitPln)} />
            <DetailStat label="Current Price" value={formatCurrencyPln(selectedHolding.currentPricePln)} />
            <DetailStat label="Current Value" value={formatCurrencyPln(selectedHolding.currentValuePln ?? selectedHolding.bookValuePln)} />
            <DetailStat label="Book Value" value={formatCurrencyPln(selectedHolding.bookValuePln)} />
            <DetailStat
              label="Unrealized P/L"
              value={formatSignedCurrencyPln(selectedHolding.unrealizedGainPln)}
              className={gainColor(selectedHolding.unrealizedGainPln)}
            />
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            {selectedHolding.transactionCount} transactions · {selectedHolding.currency}
            {selectedHolding.valuedAt ? ` · valued ${formatDate(selectedHolding.valuedAt)}` : ''}
          </div>
          {selectedHolding.valuationIssue && (
            <p className="mt-2 text-sm text-red-400">{selectedHolding.valuationIssue}</p>
          )}
        </div>
      )}
    </>
  )
}

// --- Sub-components ---

function DetailStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium tabular-nums ${className ?? 'text-zinc-100'}`}>{value}</p>
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

function compareHoldings(a: PortfolioHolding, b: PortfolioHolding, sort: SortState) {
  const f = sort.direction === 'asc' ? 1 : -1
  switch (sort.field) {
    case 'instrumentName': return f * a.instrumentName.localeCompare(b.instrumentName)
    case 'accountName': return f * a.accountName.localeCompare(b.accountName)
    case 'assetClass': return f * a.assetClass.localeCompare(b.assetClass)
    case 'valuationStatus': return f * (a.valuationStatus ?? 'UNAVAILABLE').localeCompare(b.valuationStatus ?? 'UNAVAILABLE')
    case 'quantity': return f * (asNumber(a.quantity) - asNumber(b.quantity))
    case 'unrealizedGainPln': return f * (asNumber(a.unrealizedGainPln) - asNumber(b.unrealizedGainPln))
    case 'currentValuePln': return f * (asNumber(a.currentValuePln ?? a.bookValuePln) - asNumber(b.currentValuePln ?? b.bookValuePln))
    default: return 0
  }
}

function asNumber(v: string | null | undefined) {
  return v == null || v === '' ? 0 : Number(v)
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function holdingKey(h: PortfolioHolding) {
  return `${h.accountId}:${h.instrumentId}`
}

function assetClassLabel(c: string) {
  switch (c) {
    case 'EQUITIES': return 'Equities'
    case 'BONDS': return 'Bonds'
    case 'CASH': return 'Cash'
    default: return c
  }
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
