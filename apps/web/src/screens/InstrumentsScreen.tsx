import { useMemo } from 'react'
import type { PortfolioHolding } from '../api/read-model'
import type { Instrument } from '../api/write-model'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { useInstruments } from '../hooks/use-write-model'
import { formatCurrencyPln, formatNumber, formatPercent, formatSignedCurrencyPln } from '../lib/format'
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

  const activeRows = rows.filter((row) => row.accountCount > 0)
  const degradedCount = rows.filter((row) => row.status !== 'VALUED' && row.accountCount > 0).length
  const totalValuePln = rows.reduce((sum, row) => sum + row.totalCurrentValuePln, 0)
  const totalGainPln = rows.reduce((sum, row) => sum + row.totalUnrealizedGainPln, 0)

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
            label={isPolish ? 'Niezrealizowany P/L' : 'Unrealized P/L'}
            value={formatSignedCurrencyPln(totalGainPln)}
            detail={isPolish ? 'Suma aktywnych pozycji per instrument' : 'Summed across active holdings per instrument'}
            tone={totalGainPln >= 0 ? 'success' : 'warning'}
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
                  {rows.map((row) => (
                    <tr className={tr} key={row.instrument.id}>
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
                          <p className={`tabular-nums ${row.totalUnrealizedGainPln >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatSignedCurrencyPln(row.totalUnrealizedGainPln)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {row.gainPct == null ? (isPolish ? 'n/d' : 'n/a') : formatPercent(row.gainPct, { signed: true })}
                          </p>
                        </div>
                      </td>
                      <td className={tdRight}>
                        <span className={`${badge} ${statusVariant(row.status)}`}>
                          {labelInstrumentStatus(row.status, isPolish)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

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

interface InstrumentRow {
  instrument: Instrument
  accountCount: number
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
      const quantity = instrumentHoldings.reduce((sum, holding) => sum + asNumber(holding.quantity), 0)
      const totalBookValuePln = instrumentHoldings.reduce((sum, holding) => sum + asNumber(holding.bookValuePln), 0)
      const totalCurrentValuePln = instrumentHoldings.reduce(
        (sum, holding) => sum + asNumber(holding.currentValuePln ?? holding.bookValuePln),
        0,
      )
      const totalUnrealizedGainPln = instrumentHoldings.reduce(
        (sum, holding) => sum + asNumber(holding.unrealizedGainPln ?? '0'),
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

function asNumber(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return 0
  }

  return typeof value === 'number' ? value : Number(value)
}
