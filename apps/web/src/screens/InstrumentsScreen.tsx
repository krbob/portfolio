import { useEffect, useMemo, useState } from 'react'
import type { PortfolioHolding } from '../api/read-model'
import type { Instrument } from '../api/write-model'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { useInstruments } from '../hooks/use-write-model'
import { formatCurrencyPln, formatDate } from '../lib/format'
import { getActiveUiLanguage, useI18n } from '../lib/i18n'
import { labelAssetClass, labelInstrumentKind, labelValuationSource } from '../lib/labels'
import { usePersistentState } from '../lib/persistence'
import {
  describeHoldingGainRate,
  describePortfolioGain,
  formatHoldingGainPreview,
  formatHoldingQuantity,
  formatPortfolioGainDisplay,
  parsePortfolioNumber,
} from '../lib/portfolio-presentation'
import { badge, badgeVariants, td, tdRight, th, thRight, tr } from '../lib/styles'
import { isMarketValuedStatus } from '../lib/valuation'

type SortField =
  | 'instrumentName'
  | 'catalog'
  | 'accountCount'
  | 'quantity'
  | 'totalCurrentValuePln'
  | 'totalUnrealizedGainPln'
  | 'status'

type SortDirection = 'asc' | 'desc'

interface SortState {
  field: SortField
  direction: SortDirection
}

const defaultSort: SortState = { field: 'instrumentName', direction: 'asc' }

const INSTRUMENTS_PREFERENCE_KEYS = {
  sortState: 'portfolio:view:instruments:sort-state',
} as const

export function InstrumentsScreen() {
  const { isPolish } = useI18n()
  const instrumentsQuery = useInstruments()
  const holdingsQuery = usePortfolioHoldings()

  const catalog = instrumentsQuery.data ?? []
  const holdings = holdingsQuery.data ?? []
  const rows = useMemo(() => buildInstrumentRows(catalog, holdings), [catalog, holdings])
  const [sortState, setSortState] = usePersistentState<SortState>(INSTRUMENTS_PREFERENCE_KEYS.sortState, defaultSort, { validate: isSortState })
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null)
  const sortedRows = useMemo(() => [...rows].sort((left, right) => compareRows(left, right, sortState)), [rows, sortState])

  const activeRows = rows.filter((row) => row.holdingCount > 0)
  const degradedCount = rows.filter((row) => row.status === 'DEGRADED' && row.holdingCount > 0).length
  const staleCount = rows.filter((row) => row.status === 'STALE').length
  const totalValuePln = rows.reduce((sum, row) => sum + row.totalCurrentValuePln, 0)
  const totalGainPln = rows.reduce((sum, row) => sum + row.totalUnrealizedGainPln, 0)
  const totalHoldingCount = rows.reduce((sum, row) => sum + row.holdingCount, 0)
  const totalValuedHoldingCount = rows.reduce((sum, row) => sum + row.valuedHoldingCount, 0)
  const selectedRow = sortedRows.find((row) => row.instrument.id === selectedInstrumentId) ?? sortedRows[0] ?? null
  const selectedHoldings = useMemo(
    () => holdings
      .filter((holding) => holding.instrumentId === selectedRow?.instrument.id)
      .sort((left, right) => parsePortfolioNumber(right.currentValuePln ?? right.bookValuePln) - parsePortfolioNumber(left.currentValuePln ?? left.bookValuePln)),
    [holdings, selectedRow?.instrument.id],
  )

  useEffect(() => {
    if (sortedRows.length === 0) {
      setSelectedInstrumentId(null)
      return
    }

    if (!selectedInstrumentId || !sortedRows.some((row) => row.instrument.id === selectedInstrumentId)) {
      setSelectedInstrumentId(sortedRows[0]?.instrument.id ?? null)
    }
  }, [sortedRows, selectedInstrumentId])

  if (instrumentsQuery.isLoading || holdingsQuery.isLoading) {
    return (
      <>
        <PageHeader title={isPolish ? 'Instrumenty' : 'Instruments'} />
        <LoadingState
          title={isPolish ? 'Ładowanie instrumentów' : 'Loading instruments'}
          description={isPolish
            ? 'Budowanie widoku instrumentów i ekspozycji na rachunkach.'
            : 'Combining the instrument catalog with exposure across accounts.'}
          blocks={4}
        />
      </>
    )
  }

  if (instrumentsQuery.isError || holdingsQuery.isError) {
    return (
      <>
        <PageHeader title={isPolish ? 'Instrumenty' : 'Instruments'} />
        <ErrorState
          title={isPolish ? 'Instrumenty niedostępne' : 'Instruments unavailable'}
          description={isPolish
            ? 'Nie udało się zbudować widoku instrumentów. Spróbuj ponownie albo sprawdź stan systemu.'
            : 'The instrument view could not be assembled. Retry now or inspect system health.'}
          onRetry={() => {
            void Promise.all([instrumentsQuery.refetch(), holdingsQuery.refetch()])
          }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={isPolish ? 'Instrumenty' : 'Instruments'}>
        <Badge variant="default">
          {rows.length} {isPolish ? (rows.length === 1 ? 'instrument' : 'instrumentów') : 'instruments'}
        </Badge>
        {rows.length > 0 && (
          <span className="text-sm tabular-nums text-zinc-400">{formatCurrencyPln(totalValuePln)}</span>
        )}
      </PageHeader>

      {rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InstrumentSummaryTile
            label={isPolish ? 'Katalog instrumentów' : 'Instrument catalog'}
            value={String(rows.length)}
            detail={isPolish ? `${activeRows.length} aktywnych w portfelu` : `${activeRows.length} active in portfolio`}
          />
          <InstrumentSummaryTile
            label={isPolish ? 'Łączna wartość' : 'Total value'}
            value={formatCurrencyPln(totalValuePln)}
            detail={isPolish ? `${activeRows.length} pozycji po zsumowaniu wszystkich rachunków` : `${activeRows.length} aggregates across accounts`}
          />
          <InstrumentSummaryTile
            label={isPolish ? 'Niezrealizowany wynik pozycji' : 'Unrealized holdings P/L'}
            value={formatPortfolioGainDisplay(totalGainPln, totalValuedHoldingCount, isPolish)}
            detail={describePortfolioGain(totalHoldingCount, totalValuedHoldingCount, isPolish)}
            tone={totalValuedHoldingCount === 0 ? 'default' : totalGainPln >= 0 ? 'success' : 'warning'}
          />
          <InstrumentSummaryTile
            label={isPolish ? 'Instrumenty bez pełnej wyceny' : 'Degraded instruments'}
            value={String(degradedCount)}
            detail={degradedCount === 0
              ? staleCount === 0
                ? (isPolish ? 'Każdy aktywny instrument ma świeżą wycenę rynkową' : 'Every active instrument has fresh market valuation')
                : (isPolish ? `${staleCount} ma wycenę rynkową z opóźnieniem` : `${staleCount} have stale market valuation`)
              : (isPolish
                  ? `Część instrumentów korzysta z niepełnej lub księgowej wyceny${staleCount > 0 ? ` · ${staleCount} z opóźnieniem` : ''}`
                  : `Some series fall back to book basis${staleCount > 0 ? ` · ${staleCount} stale` : ''}`)}
            tone={degradedCount === 0 && staleCount === 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),26rem]">
        <div className="grid gap-6">
          <Card flush>
            <div className="border-b border-zinc-800 px-5 py-4">
              <SectionHeader
                eyebrow={isPolish ? 'Model odczytowy' : 'Read model'}
                title={isPolish ? 'Przegląd instrumentów' : 'Instrument overview'}
                description={isPolish
                  ? 'Pozycje zebrane ponad wszystkimi rachunkami, z zachowaniem pełnego katalogu instrumentów także bez aktywnych transakcji.'
                  : 'Positions aggregated across accounts while still exposing the canonical instrument catalog.'}
              />
            </div>

            {rows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title={isPolish ? 'Brak instrumentów' : 'No instruments yet'}
                  description={isPolish
                    ? 'Dodaj pierwszy instrument po prawej stronie, aby zbudować katalog portfela.'
                    : 'Add the first instrument on the right to build the portfolio catalog.'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-950/30">
                    <tr>
                      <SortableHeader sort={sortState} field="instrumentName" label={isPolish ? 'Instrument' : 'Instrument'} onToggle={setSortState} />
                      <SortableHeader sort={sortState} field="catalog" label={isPolish ? 'Katalog' : 'Catalog'} onToggle={setSortState} />
                      <SortableHeader sort={sortState} field="accountCount" label={isPolish ? 'Konta' : 'Accounts'} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="quantity" label={isPolish ? 'Ilość' : 'Quantity'} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="totalCurrentValuePln" label={isPolish ? 'Wartość' : 'Value'} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="totalUnrealizedGainPln" label="P/L" onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="status" label={isPolish ? 'Status' : 'Status'} onToggle={setSortState} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => {
                      const isSelected = selectedRow?.instrument.id === row.instrument.id
                      return (
                        <tr
                          className={`${tr} cursor-pointer ${isSelected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : ''}`}
                          key={row.instrument.id}
                          aria-selected={isSelected}
                          onClick={() => setSelectedInstrumentId(row.instrument.id)}
                        >
                          <td className={td}>
                            <div>
                              <p className="font-medium text-zinc-100">{row.instrument.name}</p>
                              <p className="text-xs text-zinc-500">
                                {row.instrument.symbol ? `${row.instrument.symbol} · ` : ''}
                                {row.instrument.currency}
                              </p>
                            </div>
                          </td>
                          <td className={td}>
                            <div>
                              <p className="text-zinc-200">
                                {labelInstrumentKind(row.instrument.kind)} · {labelAssetClass(row.instrument.assetClass)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {labelValuationSource(row.instrument.valuationSource)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{row.accountCount}</p>
                              <p className="text-xs text-zinc-500">
                                {row.accountCount === 0
                                  ? (isPolish ? 'tylko katalog' : 'catalog only')
                                  : (isPolish ? 'rachunków z pozycją' : 'active accounts')}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{row.accountCount === 0 ? '0' : formatHoldingQuantity(row.quantity)}</p>
                              <p className="text-xs text-zinc-500">
                                {row.transactionCount} {isPolish ? 'transakcji' : 'transactions'}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(row.totalCurrentValuePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {isPolish ? 'Koszt nabycia' : 'Cost basis'} {formatCurrencyPln(row.totalBookValuePln)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className={`tabular-nums ${
                                row.valuedHoldingCount === 0
                                  ? 'text-zinc-500'
                                  : row.totalUnrealizedGainPln >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                              }`}>
                                {formatPortfolioGainDisplay(row.totalUnrealizedGainPln, row.valuedHoldingCount, isPolish)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {describeHoldingGainRate(row.holdingCount, row.valuedHoldingCount, row.gainPct, isPolish)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <span className={`${badge} ${statusVariant(row.status)}`}>
                              {labelInstrumentStatus(row.status, isPolish)}
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

          {selectedRow && (
            <InstrumentDetailsCard
              row={selectedRow}
              holdings={selectedHoldings}
              isPolish={isPolish}
            />
          )}
        </div>

        <InstrumentsSection />
      </div>
    </>
  )
}

function InstrumentSummaryTile({
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

function InstrumentDetailsCard({
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
            {isPolish ? 'Wybrany instrument' : 'Selected instrument'}
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
          label={isPolish ? 'Konta aktywne' : 'Active accounts'}
          value={String(row.accountCount)}
          detail={row.accountCount === 0
            ? (isPolish ? 'Instrument tylko w katalogu' : 'Catalog only')
            : `${row.transactionCount} ${isPolish ? 'transakcji' : 'transactions'}`}
        />
        <InstrumentDetailMetric
          label={isPolish ? 'Łączna ilość' : 'Total quantity'}
          value={row.accountCount === 0 ? '0' : formatHoldingQuantity(row.quantity)}
          detail={isPolish ? `Koszt ${formatCurrencyPln(row.totalBookValuePln)}` : `Cost ${formatCurrencyPln(row.totalBookValuePln)}`}
        />
        <InstrumentDetailMetric
          label={isPolish ? 'Bieżąca wartość' : 'Current value'}
          value={formatCurrencyPln(row.totalCurrentValuePln)}
          detail={describeHoldingGainRate(row.holdingCount, row.valuedHoldingCount, row.gainPct, isPolish)}
          tone={row.valuedHoldingCount === 0 ? 'default' : row.totalUnrealizedGainPln >= 0 ? 'success' : 'warning'}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-zinc-100">{isPolish ? 'Podział na rachunki' : 'Account split'}</h4>
          <p className="text-xs text-zinc-500">{labelValuationSource(row.instrument.valuationSource)}</p>
        </div>

        {holdings.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            {isPolish
              ? 'Instrument jest w katalogu, ale nie ma jeszcze aktywnych pozycji.'
              : 'The instrument is in the catalog but does not have active holdings yet.'}
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
                    {formatHoldingQuantity(holding.quantity)} {isPolish ? 'szt.' : 'units'} · {holding.transactionCount} {isPolish ? 'transakcji' : 'transactions'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-zinc-100">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</p>
                  <p className="text-xs text-zinc-500">
                    {isMarketValuedStatus(holding.valuationStatus)
                      ? formatHoldingGainPreview(holding.unrealizedGainPln, isPolish)
                      : isPolish
                        ? 'Wycena księgowa'
                        : 'Book basis'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {edoLots.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-zinc-100">{isPolish ? 'Loty EDO' : 'EDO lots'}</h4>
          <div className="mt-3 space-y-2">
            {edoLots.map((lot) => (
              <div
                key={`${lot.accountId}-${lot.purchaseDate}-${lot.quantity}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">{lot.accountName}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(lot.purchaseDate)} · {formatHoldingQuantity(lot.quantity)} {isPolish ? 'szt.' : 'units'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-zinc-100">{formatCurrencyPln(lot.currentValuePln ?? lot.costBasisPln)}</p>
                  <p className="text-xs text-zinc-500">
                    {isMarketValuedStatus(lot.valuationStatus)
                      ? formatHoldingGainPreview(lot.unrealizedGainPln, isPolish)
                      : isPolish
                        ? 'Wycena księgowa'
                        : 'Book basis'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
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

function isSortField(value: unknown): value is SortField {
  return value === 'instrumentName'
    || value === 'catalog'
    || value === 'accountCount'
    || value === 'quantity'
    || value === 'totalCurrentValuePln'
    || value === 'totalUnrealizedGainPln'
    || value === 'status'
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

interface InstrumentRow {
  instrument: Instrument
  accountCount: number
  holdingCount: number
  valuedHoldingCount: number
  quantity: number
  totalBookValuePln: number
  totalCurrentValuePln: number
  totalUnrealizedGainPln: number
  gainPct: number | null
  transactionCount: number
  status: 'VALUED' | 'STALE' | 'DEGRADED' | 'CATALOG_ONLY'
}

function buildInstrumentRows(
  catalog: Instrument[],
  holdings: PortfolioHolding[],
): InstrumentRow[] {
  const holdingsByInstrument = new Map<string, PortfolioHolding[]>()

  for (const holding of holdings) {
    const bucket = holdingsByInstrument.get(holding.instrumentId) ?? []
    bucket.push(holding)
    holdingsByInstrument.set(holding.instrumentId, bucket)
  }

  return [...catalog].map((instrument) => {
      const instrumentHoldings = holdingsByInstrument.get(instrument.id) ?? []
      const accountIds = new Set(instrumentHoldings.map((holding) => holding.accountId))
      const valuedHoldingCount = instrumentHoldings.filter((holding) => isMarketValuedStatus(holding.valuationStatus)).length
      const staleHoldingCount = instrumentHoldings.filter((holding) => holding.valuationStatus === 'STALE').length
      const quantity = instrumentHoldings.reduce((sum, holding) => sum + parsePortfolioNumber(holding.quantity), 0)
      const totalBookValuePln = instrumentHoldings.reduce((sum, holding) => sum + parsePortfolioNumber(holding.bookValuePln), 0)
      const totalCurrentValuePln = instrumentHoldings.reduce(
        (sum, holding) => sum + parsePortfolioNumber(holding.currentValuePln ?? holding.bookValuePln),
        0,
      )
      const totalUnrealizedGainPln = instrumentHoldings.reduce(
        (sum, holding) => sum + parsePortfolioNumber(holding.unrealizedGainPln),
        0,
      )
      const gainPct = totalBookValuePln > 0 ? ((totalCurrentValuePln - totalBookValuePln) / totalBookValuePln) * 100 : null
      const transactionCount = instrumentHoldings.reduce((sum, holding) => sum + holding.transactionCount, 0)
      const status = instrumentHoldings.length === 0
        ? 'CATALOG_ONLY'
        : instrumentHoldings.every((holding) => isMarketValuedStatus(holding.valuationStatus))
          ? staleHoldingCount > 0
            ? 'STALE'
            : 'VALUED'
          : 'DEGRADED'

      return {
        instrument,
        accountCount: accountIds.size,
        holdingCount: instrumentHoldings.length,
        valuedHoldingCount,
        quantity,
        totalBookValuePln,
        totalCurrentValuePln,
        totalUnrealizedGainPln,
        gainPct,
        transactionCount,
        status,
      } satisfies InstrumentRow
    })
}

function compareRows(a: InstrumentRow, b: InstrumentRow, sort: SortState) {
  const factor = sort.direction === 'asc' ? 1 : -1

  switch (sort.field) {
    case 'instrumentName':
      return factor * a.instrument.name.localeCompare(b.instrument.name)
    case 'catalog':
      return factor * instrumentCatalogLabel(a).localeCompare(instrumentCatalogLabel(b))
    case 'accountCount':
      return factor * (a.accountCount - b.accountCount)
    case 'quantity':
      return factor * (a.quantity - b.quantity)
    case 'totalCurrentValuePln':
      return factor * (a.totalCurrentValuePln - b.totalCurrentValuePln)
    case 'totalUnrealizedGainPln':
      return factor * (a.totalUnrealizedGainPln - b.totalUnrealizedGainPln)
    case 'status':
      return factor * instrumentStatusLabel(a.status).localeCompare(instrumentStatusLabel(b.status))
    default:
      return 0
  }
}

function instrumentCatalogLabel(row: InstrumentRow) {
  return `${labelInstrumentKind(row.instrument.kind)} ${labelAssetClass(row.instrument.assetClass)} ${labelValuationSource(row.instrument.valuationSource)}`
}

function instrumentStatusLabel(status: InstrumentRow['status']) {
  return labelInstrumentStatus(status, getActiveUiLanguage() === 'pl')
}

function statusVariant(status: InstrumentRow['status']) {
  switch (status) {
    case 'VALUED':
      return badgeVariants.success
    case 'STALE':
      return badgeVariants.info
    case 'DEGRADED':
      return badgeVariants.warning
    case 'CATALOG_ONLY':
      return badgeVariants.default
  }
}

function labelInstrumentStatus(status: InstrumentRow['status'], isPolish: boolean) {
  switch (status) {
    case 'VALUED':
      return isPolish ? 'Pełna wycena' : 'Active'
    case 'STALE':
      return isPolish ? 'Wycena z opóźnieniem' : 'Stale'
    case 'DEGRADED':
      return isPolish ? 'Wycena niepełna' : 'Degraded'
    case 'CATALOG_ONLY':
      return isPolish ? 'Tylko w katalogu' : 'Catalog'
  }
}
