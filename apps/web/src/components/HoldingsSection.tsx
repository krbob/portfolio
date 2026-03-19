import { useDeferredValue, useMemo, useState } from 'react'
import type { PortfolioHolding } from '../api/read-model'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { formatCurrencyPln, formatSignedCurrencyPln } from '../lib/format'

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

const defaultSort: SortState = {
  field: 'currentValuePln',
  direction: 'desc',
}

export function HoldingsSection() {
  const holdingsQuery = usePortfolioHoldings()
  const holdings = holdingsQuery.data ?? []
  const [accountFilter, setAccountFilter] = useState('ALL')
  const [assetClassFilter, setAssetClassFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null)
  const [sortState, setSortState] = useState<SortState>(defaultSort)
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const filterOptions = useMemo(
    () => ({
      accounts: uniqueValues(holdings.map((holding) => holding.accountName)),
      assetClasses: uniqueValues(holdings.map((holding) => holding.assetClass)),
      statuses: uniqueValues(holdings.map((holding) => holding.valuationStatus ?? 'UNAVAILABLE')),
    }),
    [holdings],
  )

  const filteredHoldings = useMemo(() => {
    const visible = holdings.filter((holding) => {
      if (accountFilter !== 'ALL' && holding.accountName !== accountFilter) {
        return false
      }
      if (assetClassFilter !== 'ALL' && holding.assetClass !== assetClassFilter) {
        return false
      }
      if (statusFilter !== 'ALL' && (holding.valuationStatus ?? 'UNAVAILABLE') !== statusFilter) {
        return false
      }
      if (!deferredSearchQuery) {
        return true
      }

      const haystack = [
        holding.instrumentName,
        holding.accountName,
        holding.assetClass,
        holding.kind,
        holding.currency,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(deferredSearchQuery)
    })

    return [...visible].sort((left, right) => compareHoldings(left, right, sortState))
  }, [accountFilter, assetClassFilter, deferredSearchQuery, holdings, sortState, statusFilter])

  const selectedHolding =
    filteredHoldings.find((holding) => holdingKey(holding) === selectedHoldingKey) ?? filteredHoldings[0] ?? null

  const summary = useMemo(() => {
    const visibleCount = filteredHoldings.length
    const accountCount = new Set(filteredHoldings.map((holding) => holding.accountName)).size
    const valuedCount = filteredHoldings.filter((holding) => (holding.valuationStatus ?? 'UNAVAILABLE') === 'VALUED').length
    const issueCount = filteredHoldings.filter(
      (holding) => holding.valuationIssue || (holding.valuationStatus ?? 'UNAVAILABLE') !== 'VALUED',
    ).length
    const totalCurrentValue = filteredHoldings.reduce(
      (sum, holding) => sum + asNumber(holding.currentValuePln ?? holding.bookValuePln ?? '0'),
      0,
    )

    return {
      visibleCount,
      accountCount,
      valuedCount,
      issueCount,
      totalCurrentValue,
    }
  }, [filteredHoldings])

  return (
    <div className="holdings-workspace">
      <section className="summary-grid">
        <article className="overview-stat">
          <span>Visible positions</span>
          <strong>{summary.visibleCount}</strong>
        </article>
        <article className="overview-stat">
          <span>Accounts in view</span>
          <strong>{summary.accountCount}</strong>
        </article>
        <article className="overview-stat">
          <span>Current value</span>
          <strong>{formatCurrencyPln(summary.totalCurrentValue)}</strong>
        </article>
        <article className="overview-stat">
          <span>Valuation coverage</span>
          <strong>{summary.visibleCount === 0 ? '0/0' : `${summary.valuedCount}/${summary.visibleCount}`}</strong>
        </article>
      </section>

      <section className="panel holdings-panel">
        <div className="section-header">
          <p className="eyebrow">Portfolio inventory</p>
          <h3>Positions</h3>
          <p>Filter by account, asset class or valuation state, then drill into one row at a time.</p>
        </div>

        <div className="holdings-toolbar">
          <label className="journal-filter">
            <span>Account</span>
            <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
              <option value="ALL">All accounts</option>
              {filterOptions.accounts.map((accountName) => (
                <option key={accountName} value={accountName}>
                  {accountName}
                </option>
              ))}
            </select>
          </label>

          <label className="journal-filter">
            <span>Asset class</span>
            <select value={assetClassFilter} onChange={(event) => setAssetClassFilter(event.target.value)}>
              <option value="ALL">All asset classes</option>
              {filterOptions.assetClasses.map((assetClass) => (
                <option key={assetClass} value={assetClass}>
                  {assetClassLabel(assetClass)}
                </option>
              ))}
            </select>
          </label>

          <label className="journal-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              {filterOptions.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="journal-filter journal-filter-wide">
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Instrument, account, kind or currency"
            />
          </label>
        </div>

        {holdingsQuery.isLoading && <p className="muted-copy">Loading holdings...</p>}
        {holdingsQuery.isError && <p className="form-error">{holdingsQuery.error.message}</p>}
        {!holdingsQuery.isLoading && !holdingsQuery.isError && holdings.length === 0 && (
          <p className="muted-copy">No holdings yet.</p>
        )}
        {!holdingsQuery.isLoading && !holdingsQuery.isError && holdings.length > 0 && filteredHoldings.length === 0 && (
          <p className="muted-copy">No holdings match the current filters.</p>
        )}

        {!holdingsQuery.isLoading && !holdingsQuery.isError && filteredHoldings.length > 0 && (
          <>
            <div className="holdings-table-shell">
              <table className="holdings-table">
                <thead>
                  <tr>
                    <SortableHeader
                      activeSort={sortState}
                      field="instrumentName"
                      label="Instrument"
                      onToggle={setSortState}
                    />
                    <SortableHeader
                      activeSort={sortState}
                      field="accountName"
                      label="Account"
                      onToggle={setSortState}
                    />
                    <SortableHeader
                      activeSort={sortState}
                      field="assetClass"
                      label="Class"
                      onToggle={setSortState}
                    />
                    <SortableHeader
                      activeSort={sortState}
                      field="quantity"
                      label="Quantity"
                      onToggle={setSortState}
                    />
                    <SortableHeader
                      activeSort={sortState}
                      field="currentValuePln"
                      label="Current value"
                      onToggle={setSortState}
                    />
                    <SortableHeader
                      activeSort={sortState}
                      field="unrealizedGainPln"
                      label="P/L"
                      onToggle={setSortState}
                    />
                    <SortableHeader
                      activeSort={sortState}
                      field="valuationStatus"
                      label="Status"
                      onToggle={setSortState}
                    />
                  </tr>
                </thead>
                <tbody>
                  {filteredHoldings.map((holding) => {
                    const key = holdingKey(holding)
                    const valuationStatus = holding.valuationStatus ?? 'UNAVAILABLE'
                    const isSelected = key === holdingKey(selectedHolding)

                    return (
                      <tr
                        key={key}
                        className={isSelected ? 'holdings-row holdings-row-selected' : 'holdings-row'}
                        onClick={() => setSelectedHoldingKey(key)}
                      >
                        <td>
                          <div className="holdings-cell-primary">
                            <strong>{holding.instrumentName}</strong>
                            <span>{holding.kind} · {holding.currency}</span>
                          </div>
                        </td>
                        <td>{holding.accountName}</td>
                        <td>{assetClassLabel(holding.assetClass)}</td>
                        <td className="holdings-numeric">{holding.quantity}</td>
                        <td className="holdings-numeric">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</td>
                        <td className={`holdings-numeric ${gainClassName(holding.unrealizedGainPln)}`}>
                          {formatSignedCurrencyPln(holding.unrealizedGainPln)}
                        </td>
                        <td>
                          <span className={`status-badge status-${valuationStatus.toLowerCase()}`}>
                            {valuationStatus}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selectedHolding ? (
              <article className="holdings-detail-card">
                <div className="holdings-detail-header">
                  <div>
                    <p className="eyebrow">Selected position</p>
                    <h3>{selectedHolding.instrumentName}</h3>
                    <p>
                      {selectedHolding.accountName} · {selectedHolding.kind} · {assetClassLabel(selectedHolding.assetClass)}
                    </p>
                  </div>

                  <span className={`status-badge status-${(selectedHolding.valuationStatus ?? 'UNAVAILABLE').toLowerCase()}`}>
                    {selectedHolding.valuationStatus ?? 'UNAVAILABLE'}
                  </span>
                </div>

                <div className="holdings-detail-grid">
                  <article className="overview-stat">
                    <span>Quantity</span>
                    <strong>{selectedHolding.quantity}</strong>
                  </article>
                  <article className="overview-stat">
                    <span>Avg cost</span>
                    <strong>{formatCurrencyPln(selectedHolding.averageCostPerUnitPln)}</strong>
                  </article>
                  <article className="overview-stat">
                    <span>Current price</span>
                    <strong>{formatCurrencyPln(selectedHolding.currentPricePln)}</strong>
                  </article>
                  <article className="overview-stat">
                    <span>Current value</span>
                    <strong>{formatCurrencyPln(selectedHolding.currentValuePln ?? selectedHolding.bookValuePln)}</strong>
                  </article>
                  <article className="overview-stat">
                    <span>Book value</span>
                    <strong>{formatCurrencyPln(selectedHolding.bookValuePln)}</strong>
                  </article>
                  <article className="overview-stat">
                    <span>Unrealized P/L</span>
                    <strong className={gainClassName(selectedHolding.unrealizedGainPln)}>
                      {formatSignedCurrencyPln(selectedHolding.unrealizedGainPln)}
                    </strong>
                  </article>
                </div>

                <div className="overview-notes">
                  <p>
                    {selectedHolding.transactionCount} transactions · currency {selectedHolding.currency}
                    {selectedHolding.valuedAt ? ` · valued at ${selectedHolding.valuedAt}` : ''}
                  </p>
                  {selectedHolding.valuationIssue ? (
                    <p className="form-error">{selectedHolding.valuationIssue}</p>
                  ) : (
                    <p className="muted-copy">
                      No valuation issue reported for this position.
                    </p>
                  )}
                </div>
              </article>
            ) : null}

            {summary.issueCount > 0 && (
              <p className="muted-copy">
                {summary.issueCount} visible position{summary.issueCount === 1 ? '' : 's'} still require attention because of valuation gaps or unavailable pricing.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function SortableHeader({
  activeSort,
  field,
  label,
  onToggle,
}: {
  activeSort: SortState
  field: SortField
  label: string
  onToggle: (next: SortState) => void
}) {
  const isActive = activeSort.field === field
  const indicator = !isActive ? '↕' : activeSort.direction === 'asc' ? '↑' : '↓'

  return (
    <th scope="col">
      <button
        type="button"
        className={isActive ? 'holdings-sort-button holdings-sort-button-active' : 'holdings-sort-button'}
        onClick={() =>
          onToggle({
            field,
            direction: isActive && activeSort.direction === 'desc' ? 'asc' : 'desc',
          })
        }
      >
        <span>{label}</span>
        <span>{indicator}</span>
      </button>
    </th>
  )
}

function compareHoldings(left: PortfolioHolding, right: PortfolioHolding, sort: SortState) {
  const factor = sort.direction === 'asc' ? 1 : -1

  switch (sort.field) {
    case 'instrumentName':
      return factor * left.instrumentName.localeCompare(right.instrumentName)
    case 'accountName':
      return factor * left.accountName.localeCompare(right.accountName)
    case 'assetClass':
      return factor * left.assetClass.localeCompare(right.assetClass)
    case 'valuationStatus':
      return factor * (left.valuationStatus ?? 'UNAVAILABLE').localeCompare(right.valuationStatus ?? 'UNAVAILABLE')
    case 'quantity':
      return factor * compareNumbers(left.quantity, right.quantity)
    case 'unrealizedGainPln':
      return factor * compareNumbers(left.unrealizedGainPln, right.unrealizedGainPln)
    case 'currentValuePln':
      return factor * compareNumbers(left.currentValuePln ?? left.bookValuePln, right.currentValuePln ?? right.bookValuePln)
    default:
      return 0
  }
}

function compareNumbers(left: string | null | undefined, right: string | null | undefined) {
  return asNumber(left) - asNumber(right)
}

function asNumber(value: string | null | undefined) {
  if (value == null || value === '') {
    return 0
  }
  return Number(value)
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function holdingKey(holding: PortfolioHolding | null) {
  if (!holding) {
    return '__none__'
  }
  return `${holding.accountId}:${holding.instrumentId}`
}

function assetClassLabel(assetClass: string) {
  switch (assetClass) {
    case 'EQUITIES':
      return 'Equities'
    case 'BONDS':
      return 'Bonds'
    case 'CASH':
      return 'Cash'
    default:
      return assetClass
  }
}

function gainClassName(value: string | null | undefined) {
  if (value == null) {
    return undefined
  }
  const amount = Number(value)
  if (amount > 0) {
    return 'value-positive'
  }
  if (amount < 0) {
    return 'value-negative'
  }
  return undefined
}
