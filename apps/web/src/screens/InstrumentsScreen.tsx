import { useEffect, useMemo, useState } from 'react'
import type { PortfolioHolding } from '../api/read-model'
import type { Instrument } from '../api/write-model'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { useInstruments } from '../hooks/use-write-model'
import { formatCurrencyPln, formatDate, formatNumber, formatPercent, formatSignedCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAssetClass, labelInstrumentKind, labelValuationSource } from '../lib/labels'
import { badge, badgeVariants, td, tdRight, th, thRight, tr } from '../lib/styles'

export function InstrumentsScreen() {
  const { isPolish } = useI18n()
  const instrumentsQuery = useInstruments()
  const holdingsQuery = usePortfolioHoldings()

  const catalog = instrumentsQuery.data ?? []
  const holdings = holdingsQuery.data ?? []
  const rows = useMemo(() => buildInstrumentRows(catalog, holdings), [catalog, holdings])
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null)

  const activeRows = rows.filter((row) => row.holdingCount > 0)
  const degradedCount = rows.filter((row) => row.status !== 'VALUED' && row.holdingCount > 0).length
  const totalValuePln = rows.reduce((sum, row) => sum + row.totalCurrentValuePln, 0)
  const totalGainPln = rows.reduce((sum, row) => sum + row.totalUnrealizedGainPln, 0)
  const totalHoldingCount = rows.reduce((sum, row) => sum + row.holdingCount, 0)
  const totalValuedHoldingCount = rows.reduce((sum, row) => sum + row.valuedHoldingCount, 0)
  const selectedRow = rows.find((row) => row.instrument.id === selectedInstrumentId) ?? rows[0] ?? null
  const selectedHoldings = useMemo(
    () => holdings
      .filter((holding) => holding.instrumentId === selectedRow?.instrument.id)
      .sort((left, right) => asNumber(right.currentValuePln ?? right.bookValuePln) - asNumber(left.currentValuePln ?? left.bookValuePln)),
    [holdings, selectedRow?.instrument.id],
  )

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedInstrumentId(null)
      return
    }

    if (!selectedInstrumentId || !rows.some((row) => row.instrument.id === selectedInstrumentId)) {
      setSelectedInstrumentId(rows[0]?.instrument.id ?? null)
    }
  }, [rows, selectedInstrumentId])

  if (instrumentsQuery.isLoading || holdingsQuery.isLoading) {
    return (
      <>
        <PageHeader title={isPolish ? 'Instrumenty' : 'Instruments'} />
        <LoadingState
          title={isPolish ? 'Ładowanie instrumentów' : 'Loading instruments'}
          description={isPolish
            ? 'Składanie katalogu instrumentów i ich ekspozycji ponad rachunkami.'
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
            detail={isPolish ? `${activeRows.length} agregatów ponad kontami` : `${activeRows.length} aggregates across accounts`}
          />
          <InstrumentSummaryTile
            label={isPolish ? 'Niezrealizowany P/L pozycji' : 'Unrealized holdings P/L'}
            value={formatGainDisplay(totalGainPln, totalValuedHoldingCount, isPolish)}
            detail={describePortfolioGain(totalHoldingCount, totalValuedHoldingCount, isPolish)}
            tone={totalValuedHoldingCount === 0 ? 'default' : totalGainPln >= 0 ? 'success' : 'warning'}
          />
          <InstrumentSummaryTile
            label={isPolish ? 'Instrumenty zdegradowane' : 'Degraded instruments'}
            value={String(degradedCount)}
            detail={degradedCount === 0
              ? (isPolish ? 'Każdy aktywny instrument ma bieżącą wycenę' : 'Every active instrument has a current valuation')
              : (isPolish ? 'Część serii nadal spada do podstawy księgowej' : 'Some series still fall back to book basis')}
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
                title={isPolish ? 'Przegląd instrumentów' : 'Instrument overview'}
                description={isPolish
                  ? 'Agregacja pozycji ponad kontami, z zachowaniem katalogu instrumentów nawet bez aktywnych transakcji.'
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
                      <th className={th}>{isPolish ? 'Instrument' : 'Instrument'}</th>
                      <th className={th}>{isPolish ? 'Katalog' : 'Catalog'}</th>
                      <th className={thRight}>{isPolish ? 'Konta' : 'Accounts'}</th>
                      <th className={thRight}>{isPolish ? 'Ilość' : 'Quantity'}</th>
                      <th className={thRight}>{isPolish ? 'Wartość' : 'Value'}</th>
                      <th className={thRight}>{isPolish ? 'P/L' : 'P/L'}</th>
                      <th className={thRight}>{isPolish ? 'Status' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
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
                                  : (isPolish ? 'aktywnych rachunków' : 'active accounts')}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{row.accountCount === 0 ? '0' : formatNumber(row.quantity, { maximumFractionDigits: 4 })}</p>
                              <p className="text-xs text-zinc-500">
                                {row.transactionCount} {isPolish ? 'transakcji' : 'transactions'}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(row.totalCurrentValuePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {isPolish ? 'Koszt' : 'Cost basis'} {formatCurrencyPln(row.totalBookValuePln)}
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
                                {formatGainDisplay(row.totalUnrealizedGainPln, row.valuedHoldingCount, isPolish)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {describeInstrumentGain(row.holdingCount, row.valuedHoldingCount, row.gainPct, isPolish)}
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
          value={row.accountCount === 0 ? '0' : formatNumber(row.quantity, { maximumFractionDigits: 4 })}
          detail={isPolish ? `Koszt ${formatCurrencyPln(row.totalBookValuePln)}` : `Cost ${formatCurrencyPln(row.totalBookValuePln)}`}
        />
        <InstrumentDetailMetric
          label={isPolish ? 'Bieżąca wartość' : 'Current value'}
          value={formatCurrencyPln(row.totalCurrentValuePln)}
          detail={describeInstrumentGain(row.holdingCount, row.valuedHoldingCount, row.gainPct, isPolish)}
          tone={row.valuedHoldingCount === 0 ? 'default' : row.totalUnrealizedGainPln >= 0 ? 'success' : 'warning'}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-zinc-100">{isPolish ? 'Rozbicie per konto' : 'Account split'}</h4>
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
                    {holding.quantity} {isPolish ? 'szt.' : 'units'} · {holding.transactionCount} {isPolish ? 'transakcji' : 'transactions'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-zinc-100">{formatCurrencyPln(holding.currentValuePln ?? holding.bookValuePln)}</p>
                  <p className="text-xs text-zinc-500">
                    {holding.valuationStatus === 'VALUED'
                      ? formatSignedCurrencyPln(holding.unrealizedGainPln ?? '0')
                      : isPolish
                        ? 'Księgowo'
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
                    {formatDate(lot.purchaseDate)} · {lot.quantity} {isPolish ? 'szt.' : 'units'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-zinc-100">{formatCurrencyPln(lot.currentValuePln ?? lot.costBasisPln)}</p>
                  <p className="text-xs text-zinc-500">
                    {lot.valuationStatus === 'VALUED'
                      ? formatSignedCurrencyPln(lot.unrealizedGainPln ?? '0')
                      : isPolish
                        ? 'Księgowo'
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
  status: 'VALUED' | 'DEGRADED' | 'CATALOG_ONLY'
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

  return [...catalog]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((instrument) => {
      const instrumentHoldings = holdingsByInstrument.get(instrument.id) ?? []
      const accountIds = new Set(instrumentHoldings.map((holding) => holding.accountId))
      const valuedHoldingCount = instrumentHoldings.filter((holding) => holding.valuationStatus === 'VALUED').length
      const quantity = instrumentHoldings.reduce((sum, holding) => sum + asNumber(holding.quantity), 0)
      const totalBookValuePln = instrumentHoldings.reduce((sum, holding) => sum + asNumber(holding.bookValuePln), 0)
      const totalCurrentValuePln = instrumentHoldings.reduce(
        (sum, holding) => sum + asNumber(holding.currentValuePln ?? holding.bookValuePln),
        0,
      )
      const totalUnrealizedGainPln = instrumentHoldings.reduce(
        (sum, holding) => sum + asNumber(holding.unrealizedGainPln),
        0,
      )
      const gainPct = totalBookValuePln > 0 ? ((totalCurrentValuePln - totalBookValuePln) / totalBookValuePln) * 100 : null
      const transactionCount = instrumentHoldings.reduce((sum, holding) => sum + holding.transactionCount, 0)
      const status = instrumentHoldings.length === 0
        ? 'CATALOG_ONLY'
        : instrumentHoldings.every((holding) => holding.valuationStatus === 'VALUED')
          ? 'VALUED'
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

function statusVariant(status: InstrumentRow['status']) {
  switch (status) {
    case 'VALUED':
      return badgeVariants.success
    case 'DEGRADED':
      return badgeVariants.warning
    case 'CATALOG_ONLY':
      return badgeVariants.default
  }
}

function labelInstrumentStatus(status: InstrumentRow['status'], isPolish: boolean) {
  switch (status) {
    case 'VALUED':
      return isPolish ? 'Aktywny' : 'Active'
    case 'DEGRADED':
      return isPolish ? 'Częściowy' : 'Degraded'
    case 'CATALOG_ONLY':
      return isPolish ? 'Katalog' : 'Catalog'
  }
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
      : 'No live pricing for active holdings'
  }

  if (valuedHoldingCount < activeHoldingCount) {
    return isPolish
      ? `${valuedHoldingCount}/${activeHoldingCount} pozycji z wyceną rynkową`
      : `${valuedHoldingCount}/${activeHoldingCount} holdings with live pricing`
  }

  return isPolish ? 'Tylko aktywne pozycje' : 'Active holdings only'
}

function describeInstrumentGain(
  holdingCount: number,
  valuedHoldingCount: number,
  gainPct: number | null,
  isPolish: boolean,
) {
  if (holdingCount === 0) {
    return isPolish ? 'Brak aktywnych pozycji' : 'No active holdings'
  }

  if (valuedHoldingCount === 0) {
    return isPolish ? 'Brak wyceny rynkowej' : 'No live pricing'
  }

  if (valuedHoldingCount < holdingCount) {
    return isPolish
      ? `${valuedHoldingCount}/${holdingCount} pozycji wycenionych`
      : `${valuedHoldingCount}/${holdingCount} holdings valued`
  }

  return gainPct == null ? (isPolish ? 'n/d' : 'n/a') : formatPercent(gainPct, { signed: true })
}

function asNumber(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return 0
  }

  return typeof value === 'number' ? value : Number(value)
}
